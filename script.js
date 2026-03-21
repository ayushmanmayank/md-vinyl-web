const audio = document.getElementById("audioPlayer");
const vinyl = document.querySelector(".vinyl");
const playPauseBtn = document.getElementById("playPauseBtn");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");
const seekBar = document.getElementById("seekBar");
const volumeDownBtn = document.getElementById("volumeDownBtn");
const volumeUpBtn = document.getElementById("volumeUpBtn");
const currentTimeEl = document.getElementById("currentTime");
const durationEl = document.getElementById("duration");
const statusText = document.getElementById("statusText");
const trackTitle = document.getElementById("trackTitle");
const fileNameText = document.getElementById("fileName");
const dropZone = document.getElementById("dropZone");
const connectFolderBtn = document.getElementById("connectFolderBtn");
const folderHint = document.getElementById("folderHint");
const turntablePanel = document.querySelector(".turntable-panel");
const playlistList = document.getElementById("playlistList");
const playlistNowPlaying = document.getElementById("playlistNowPlaying");
const volumeStrawberries = document.getElementById("volumeStrawberries");
const MAX_VOLUME_LEVEL = 5;
const MIN_VOLUME_LEVEL = 1;

let trackName = "No song loaded";
let currentObjectUrl = "";
let isLoadingFile = false;
let loadTimeoutId = null;
let hasLoadedTrack = false;
let playlist = [];
let playlistIndex = -1;
let pendingAutoplay = false;
let volumeLevel = 4;

function isAudioFile(file) {
	if (!file) {
		return false;
	}

	if (file.type && file.type.startsWith("audio/")) {
		return true;
	}

	return /\.(mp3|wav|ogg|m4a|aac|flac|opus|wma)$/i.test(file.name || "");
}

function normalizeTrackName(fileName) {
	return fileName.replace(/\.[^.]+$/, "");
}

function sortFilesForPlaylist(files) {
	return files.sort((a, b) => {
		const left = (a.webkitRelativePath || a.name || "").toLowerCase();
		const right = (b.webkitRelativePath || b.name || "").toLowerCase();
		return left.localeCompare(right);
	});
	if (playlist.length > 1) {
		fileNameText.textContent = `${playlistIndex + 1}/${playlist.length} ${file.name}`;
		return;
	}

	fileNameText.textContent = file.name;
}

function setPlaylist(files, startIndex = 0, autoplay = false) {
	const onlyAudio = sortFilesForPlaylist(files.filter(isAudioFile));
	if (onlyAudio.length === 0) {
		playlist = [];
		playlistIndex = -1;
		renderPlaylist();
		statusText.textContent = "No audio files found";
		return;
	}

	playlist = onlyAudio;
	playlistIndex = Math.min(Math.max(startIndex, 0), playlist.length - 1);
	renderPlaylist();
	loadSelectedFile(playlist[playlistIndex], { autoPlay: autoplay });
}

function goToPlaylistTrack(nextIndex, autoplay = true) {
	if (playlist.length === 0) {
		return;
	}

	playlistIndex = ((nextIndex % playlist.length) + playlist.length) % playlist.length;
	renderPlaylist();
	loadSelectedFile(playlist[playlistIndex], { autoPlay: autoplay });
}

function renderPlaylist() {
	if (!playlistList) {
		return;
	}

	if (playlistNowPlaying) {
		if (playlist.length > 0 && playlistIndex >= 0) {
			playlistNowPlaying.textContent = `Now playing: ${normalizeTrackName(playlist[playlistIndex].name)}`;
		} else {
			playlistNowPlaying.textContent = "Now playing: None";
		}
	}

	playlistList.innerHTML = "";

	if (playlist.length === 0) {
		const emptyItem = document.createElement("li");
		emptyItem.className = "playlist-empty";
		emptyItem.textContent = "Drop a folder to build playlist";
		playlistList.appendChild(emptyItem);
		return;
	}

	playlist.forEach((file, index) => {
		const li = document.createElement("li");
		const button = document.createElement("button");
		button.type = "button";
		button.className = "playlist-item";
		button.textContent = `${index + 1}. ${normalizeTrackName(file.name)}`;
		if (index === playlistIndex) {
			button.classList.add("active");
		}
		button.addEventListener("click", () => {
			if (index === playlistIndex) {
				playFromControls();
				return;
			}
			goToPlaylistTrack(index, true);
		});
		li.appendChild(button);
		playlistList.appendChild(li);
	});
}

function readAllDirectoryEntries(reader) {
	return new Promise((resolve, reject) => {
		const entries = [];
		function readChunk() {
			reader.readEntries((chunk) => {
				if (!chunk.length) {
					resolve(entries);
					return;
				}
				entries.push(...chunk);
				readChunk();
			}, reject);
		}
		readChunk();
	});
}

async function fileFromEntry(entry) {
	return new Promise((resolve, reject) => {
		entry.file(resolve, reject);
	});
}

async function collectFilesFromEntry(entry) {
	if (entry.isFile) {
		const file = await fileFromEntry(entry);
		return [file];
	}

	if (entry.isDirectory) {
		const reader = entry.createReader();
		const children = await readAllDirectoryEntries(reader);
		const nested = await Promise.all(children.map(collectFilesFromEntry));
		return nested.flat();
	}

	return [];
}

async function getDroppedAudioFiles(dataTransfer) {
	const items = Array.from(dataTransfer.items || []);
	if (items.length) {
		const entryFiles = [];
		for (const item of items) {
			const entry = item.webkitGetAsEntry && item.webkitGetAsEntry();
			if (entry) {
				const files = await collectFilesFromEntry(entry);
				entryFiles.push(...files);
			} else {
				const file = item.getAsFile && item.getAsFile();
				if (file) {
					entryFiles.push(file);
				}
			}
		}
		return entryFiles.filter(isAudioFile);
	}

	return Array.from(dataTransfer.files || []).filter(isAudioFile);
}

async function collectAudioFilesFromDirectoryHandle(directoryHandle) {
	const files = [];

	for await (const entry of directoryHandle.values()) {
		if (entry.kind === "file") {
			const file = await entry.getFile();
			if (isAudioFile(file)) {
				files.push(file);
			}
			continue;
		}

		if (entry.kind === "directory") {
			const nestedFiles = await collectAudioFilesFromDirectoryHandle(entry);
			files.push(...nestedFiles);
		}
	}

	return files;
}

async function connectLaptopMusicFolder() {
	if (!("showDirectoryPicker" in window)) {
		statusText.textContent = "Folder picker not supported in this browser";
		if (folderHint) {
			folderHint.textContent = "Use drag-and-drop folder import in this browser.";
		}
		return;
	}

	if (connectFolderBtn) {
		connectFolderBtn.disabled = true;
	}

	try {
		statusText.textContent = "Select your Music folder...";
		const directoryHandle = await window.showDirectoryPicker({ mode: "read" });
		statusText.textContent = "Scanning selected folder...";
		const files = await collectAudioFilesFromDirectoryHandle(directoryHandle);
		setPlaylist(files, 0, false);

		if (folderHint) {
			const audioCount = files.filter(isAudioFile).length;
			folderHint.textContent = `${directoryHandle.name} connected (${audioCount} songs found)`;
		}
	} catch (error) {
		if (error && error.name === "AbortError") {
			statusText.textContent = "Folder selection canceled";
			return;
		}

		statusText.textContent = "Could not access selected folder";
		if (folderHint) {
			folderHint.textContent = "Access failed. Try again or use drag-and-drop.";
		}
	} finally {
		if (connectFolderBtn) {
			connectFolderBtn.disabled = false;
		}
	}
}

function updateMediaSessionMetadata() {
	if (!("mediaSession" in navigator)) {
		return;
	}

	navigator.mediaSession.metadata = new MediaMetadata({
		title: hasLoadedTrack ? trackName : "No song loaded",
		artist: "MD Vinyl",
		album: "Studio Deck",
		artwork: [
			{ src: "./images/vinyl-star.svg", sizes: "512x512", type: "image/svg+xml" }
		]
	});
}

function setMediaPlaybackState(isPlaying) {
	if (!("mediaSession" in navigator)) {
		return;
	}

	navigator.mediaSession.playbackState = isPlaying ? "playing" : "paused";
}

function playFromControls() {
	if (!audio.src) {
		statusText.textContent = "Load a song first";
		return;
	}

	audio.play()
		.then(() => setPlayingState(true))
		.catch(() => {
			statusText.textContent = "Playback blocked";
		});
}

function pauseFromControls() {
	audio.pause();
	setPlayingState(false);
}

function previousFromControls() {
	if (playlist.length > 1) {
		if (audio.currentTime > 3) {
			audio.currentTime = 0;
			syncUiWhilePlaying();
			return;
		}
		goToPlaylistTrack(playlistIndex - 1, true);
		return;
	}

	audio.currentTime = 0;
	statusText.textContent = "Restarted";
	syncUiWhilePlaying();
}

function nextFromControls() {
	if (playlist.length > 1) {
		goToPlaylistTrack(playlistIndex + 1, true);
		return;
	}

	audio.currentTime = audio.duration ? Math.max(audio.duration - 0.2, 0) : 0;
	statusText.textContent = "Skipping to end";
	syncUiWhilePlaying();
}

function registerMediaSessionHandlers() {
	if (!("mediaSession" in navigator)) {
		return;
	}

	navigator.mediaSession.setActionHandler("play", playFromControls);
	navigator.mediaSession.setActionHandler("pause", pauseFromControls);
	navigator.mediaSession.setActionHandler("previoustrack", previousFromControls);
	navigator.mediaSession.setActionHandler("nexttrack", nextFromControls);
	navigator.mediaSession.setActionHandler("seekbackward", () => {
		audio.currentTime = Math.max(audio.currentTime - 10, 0);
		syncUiWhilePlaying();
	});
	navigator.mediaSession.setActionHandler("seekforward", () => {
		audio.currentTime = Math.min(audio.currentTime + 10, audio.duration || audio.currentTime + 10);
		syncUiWhilePlaying();
	});
}

function formatTime(seconds) {
	if (!Number.isFinite(seconds)) {
		return "0:00";
	}

	const mins = Math.floor(seconds / 60);
	const secs = Math.floor(seconds % 60)
		.toString()
		.padStart(2, "0");
	return `${mins}:${secs}`;
}

function setRangeProgress(input, value, max) {
	const percent = max > 0 ? (value / max) * 100 : 0;
	input.style.setProperty("--progress", `${percent}%`);
}

function updateStrawberryVolumeUI(level) {
	const safeLevel = Math.min(Math.max(level, MIN_VOLUME_LEVEL), MAX_VOLUME_LEVEL);
	if (volumeStrawberries) {
		volumeStrawberries.textContent = "\u{1F353} ".repeat(safeLevel).trim();
	}
}

function setVolumeLevel(level) {
	volumeLevel = Math.min(Math.max(level, MIN_VOLUME_LEVEL), MAX_VOLUME_LEVEL);
	audio.volume = volumeLevel / MAX_VOLUME_LEVEL;
	updateStrawberryVolumeUI(volumeLevel);
}

function syncUiWhilePlaying() {
	const { currentTime, duration } = audio;
	seekBar.value = duration ? (currentTime / duration) * 100 : 0;
	currentTimeEl.textContent = formatTime(currentTime);
	setRangeProgress(seekBar, Number(seekBar.value), 100);
}

function setPlayingState(isPlaying) {
	if (isLoadingFile) {
		return;
	}

	playPauseBtn.textContent = isPlaying ? "PAUSE" : "PLAY";
	statusText.textContent = isPlaying ? "Now Playing" : hasLoadedTrack ? "Ready" : "Not Launched";
	trackTitle.textContent = trackName;
	vinyl.classList.toggle("spinning", isPlaying);
	vinyl.classList.toggle("paused", !isPlaying);
	turntablePanel.classList.toggle("playing", isPlaying);
	setMediaPlaybackState(isPlaying);
}

function setLoadingState(isLoading) {
	isLoadingFile = isLoading;
	playPauseBtn.disabled = isLoading;

	if (!isLoading && loadTimeoutId) {
		window.clearTimeout(loadTimeoutId);
		loadTimeoutId = null;
	}
}

playPauseBtn.addEventListener("click", async () => {
	if (isLoadingFile) {
		return;
	}

	if (audio.paused) {
		if (!audio.src) {
			statusText.textContent = "Load a song first";
			return;
		}

		try {
			playFromControls();
		} catch {
			statusText.textContent = "Playback blocked";
		}
	} else {
		pauseFromControls();
	}
});

function loadSelectedFile(file, options = {}) {
	const { autoPlay = false } = options;
	pendingAutoplay = autoPlay;

	if (!file) {
		return;
	}

	if (file.type && !file.type.startsWith("audio/")) {
		statusText.textContent = "Please choose an audio file";
		return;
	}

	setLoadingState(true);
	statusText.textContent = "Loading song...";
	updateFileNameLabel(file);
    loadTimeoutId = window.setTimeout(() => {
		statusText.textContent = "Load timeout. Try another file";
		pendingAutoplay = false;
		setLoadingState(false);
	}, 7000);

	window.setTimeout(() => {
		audio.pause();
		audio.currentTime = 0;
		if (currentObjectUrl) {
			URL.revokeObjectURL(currentObjectUrl);
		}

		currentObjectUrl = URL.createObjectURL(file);
		audio.src = currentObjectUrl;
		audio.load();
		trackName = normalizeTrackName(file.name);
		hasLoadedTrack = true;
		updateMediaSessionMetadata();
		trackTitle.textContent = trackName;
		renderPlaylist();
		seekBar.value = 0;
		currentTimeEl.textContent = "0:00";
		durationEl.textContent = "0:00";
		setRangeProgress(seekBar, 0, 100);
		vinyl.classList.add("paused");
		turntablePanel.classList.remove("playing");
	}, 0);

	// Reset input so selecting the same file again still triggers change.
	trackFileInput.value = "";
}

trackFileInput.addEventListener("change", (event) => {
	const files = Array.from(event.target.files || []);
	setPlaylist(files, 0, false);
});

dropZone.addEventListener("dragover", (event) => {
	event.preventDefault();
	dropZone.classList.add("drag-over");
});

dropZone.addEventListener("dragleave", () => {
	dropZone.classList.remove("drag-over");
});

dropZone.addEventListener("drop", async (event) => {
	event.preventDefault();
	dropZone.classList.remove("drag-over");
	statusText.textContent = "Scanning dropped files...";
	const files = await getDroppedAudioFiles(event.dataTransfer);
	setPlaylist(files, 0, false);
});

if (connectFolderBtn) {
	connectFolderBtn.addEventListener("click", () => {
		connectLaptopMusicFolder();
	});
}

seekBar.addEventListener("input", () => {
	const seekPercent = Number(seekBar.value);
	setRangeProgress(seekBar, seekPercent, 100);

	if (Number.isFinite(audio.duration) && audio.duration > 0) {
		audio.currentTime = (seekPercent / 100) * audio.duration;
	}
});

if (volumeDownBtn) {
	volumeDownBtn.addEventListener("click", () => {
		setVolumeLevel(volumeLevel - 1);
	});
}

if (volumeUpBtn) {
	volumeUpBtn.addEventListener("click", () => {
		setVolumeLevel(volumeLevel + 1);
	});
}

audio.addEventListener("loadedmetadata", () => {
	durationEl.textContent = formatTime(audio.duration);
	trackTitle.textContent = trackName;
	statusText.textContent = "Song loaded";
	updateMediaSessionMetadata();
	setLoadingState(false);
	setRangeProgress(seekBar, Number(seekBar.value), 100);
	updateStrawberryVolumeUI(volumeLevel);
	if (pendingAutoplay) {
		pendingAutoplay = false;
		playFromControls();
	}
});

audio.addEventListener("canplay", () => {
	if (audio.src) {
		statusText.textContent = hasLoadedTrack ? "Ready" : "Not Launched";
		setLoadingState(false);
	}
});

audio.addEventListener("error", () => {
	statusText.textContent = "File failed to load";
	pendingAutoplay = false;
	setLoadingState(false);
	setPlayingState(false);
});

audio.addEventListener("timeupdate", syncUiWhilePlaying);

audio.addEventListener("ended", () => {
	if (playlist.length > 1) {
		goToPlaylistTrack(playlistIndex + 1, true);
		return;
	}

	audio.currentTime = 0;
	seekBar.value = 0;
	currentTimeEl.textContent = "0:00";
	setRangeProgress(seekBar, 0, 100);
	setPlayingState(false);
	setMediaPlaybackState(false);
	statusText.textContent = "Playback complete";
});

prevBtn.addEventListener("click", () => {
	previousFromControls();
});

nextBtn.addEventListener("click", () => {
	nextFromControls();
});

setRangeProgress(seekBar, 0, 100);
setVolumeLevel(volumeLevel);
vinyl.classList.add("disc-black");
registerMediaSessionHandlers();
updateMediaSessionMetadata();
renderPlaylist();
setPlayingState(false);
