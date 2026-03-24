const audio = document.getElementById("player") || document.getElementById("audioPlayer");
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
const trackFileInput = document.getElementById("trackFileInput");
const localFileBtn = document.getElementById("localFileBtn");
const connectFolderBtn = document.getElementById("connectFolderBtn");
const folderHint = document.getElementById("folderHint");
const turntablePanel = document.querySelector(".turntable-panel");
const playlistList = document.getElementById("playlistList");
const playlistNowPlaying = document.getElementById("playlistNowPlaying");
const volumeStrawberries = document.getElementById("volumeStrawberries");
const spotifyUrlInput = document.getElementById("spotifyUrlInput");
const spotifyLoadBtn = document.getElementById("spotifyLoadBtn");
const spotifyEmbed = document.getElementById("spotifyEmbed");
const shuffleBtn = document.getElementById("shuffleBtn");
const repeatBtn = document.getElementById("repeatBtn");
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
let isShuffleEnabled = false;
let repeatMode = "off";
let spotifyController = null;
let spotifyApiPromise = null;
const spotifyTrackTitleCache = new Map();

function spotifyUriToWebUrl(uri) {
	if (!uri || typeof uri !== "string") {
		return "";
	}

	if (uri.startsWith("https://open.spotify.com/")) {
		return uri;
	}

	if (!uri.startsWith("spotify:")) {
		return "";
	}

	const parts = uri.split(":");
	if (parts.length < 3) {
		return "";
	}

	return `https://open.spotify.com/${parts[1]}/${parts[2]}`;
}

async function fetchSpotifyTrackTitleFromUri(uri) {
	if (!uri || spotifyTrackTitleCache.has(uri)) {
		return spotifyTrackTitleCache.get(uri) || "";
	}

	const trackUrl = spotifyUriToWebUrl(uri);
	if (!trackUrl) {
		return "";
	}

	try {
		const response = await fetch(`https://open.spotify.com/oembed?url=${encodeURIComponent(trackUrl)}`);
		if (!response.ok) {
			return "";
		}

		const payload = await response.json();
		const title = typeof payload.title === "string" ? payload.title.trim() : "";
		if (!title) {
			return "";
		}

		const cleaned = title.replace(/\s*[\-|\u2013]\s*song by .*$/i, "").trim();
		spotifyTrackTitleCache.set(uri, cleaned || title);
		return spotifyTrackTitleCache.get(uri) || "";
	} catch {
		return "";
	}
}

function extractTitleFromUnknownPayload(payload) {
	if (!payload || typeof payload !== "object") {
		return "";
	}

	const queue = [payload];
	const seen = new Set();

	while (queue.length > 0) {
		const current = queue.shift();
		if (!current || typeof current !== "object" || seen.has(current)) {
			continue;
		}
		seen.add(current);

		const candidateUri = typeof current.uri === "string" ? current.uri : "";
		const candidateName =
			typeof current.name === "string"
				? current.name.trim()
				: typeof current.title === "string"
					? current.title.trim()
					: "";

		if (candidateName && (candidateUri.startsWith("spotify:track:") || candidateUri.includes("/track/"))) {
			return candidateName;
		}

		for (const value of Object.values(current)) {
			if (value && typeof value === "object") {
				queue.push(value);
			}
		}
	}

	return "";
}

function setDeckAnimation(isPlaying) {
	vinyl.classList.toggle("spinning", isPlaying);
	vinyl.classList.toggle("paused", !isPlaying);
	turntablePanel.classList.toggle("playing", isPlaying);
	document.body.classList.toggle("music-playing", isPlaying);
}

function parseSpotifyResource(rawValue) {
	if (!rawValue) {
		return null;
	}

	const input = rawValue.trim();
	if (!input) {
		return null;
	}

	if (input.startsWith("spotify:")) {
		const parts = input.split(":");
		if (parts.length >= 3) {
			const type = parts[1];
			const id = parts[2];
			return type && id ? { type, id } : null;
		}
		return null;
	}

	let parsed;
	try {
		parsed = new URL(input);
	} catch {
		return null;
	}

	if (!/spotify\.com$/i.test(parsed.hostname)) {
		return null;
	}

	const segments = parsed.pathname.split("/").filter(Boolean);
	if (segments[0] === "embed") {
		if (segments.length >= 3) {
			return { type: segments[1], id: segments[2] };
		}
		return null;
	}

	if (segments.length < 2) {
		return null;
	}

	return { type: segments[0], id: segments[1] };
}

function ensureSpotifyIframeApi() {
	if (window.SpotifyIframeApi && typeof window.SpotifyIframeApi.createController === "function") {
		return Promise.resolve(window.SpotifyIframeApi);
	}

	if (spotifyApiPromise) {
		return spotifyApiPromise;
	}

	spotifyApiPromise = new Promise((resolve, reject) => {
		const timeoutId = window.setTimeout(() => {
			reject(new Error("Spotify API load timeout"));
		}, 8000);

		window.onSpotifyIframeApiReady = (iframeApi) => {
			window.clearTimeout(timeoutId);
			resolve(iframeApi);
		};

		const existingScript = document.querySelector('script[data-spotify-iframe-api="true"]');
		if (!existingScript) {
			const script = document.createElement("script");
			script.src = "https://open.spotify.com/embed/iframe-api/v1";
			script.async = true;
			script.dataset.spotifyIframeApi = "true";
			script.addEventListener("error", () => {
				window.clearTimeout(timeoutId);
				reject(new Error("Spotify API script failed"));
			});
			document.body.appendChild(script);
		}
	});

	return spotifyApiPromise;
}

function bindSpotifyPlaybackUpdates(controller) {
	if (!controller || controller.__mdPlaybackBound) {
		return;
	}

	function extractSpotifyTrackTitle(payload) {
		if (!payload || typeof payload !== "object") {
			return "";
		}

		const directTrack = payload.item || payload.track || payload.current_track || null;
		const nestedTrack =
			(payload.track_window && payload.track_window.current_track) ||
			(payload.trackWindow && (payload.trackWindow.current_track || payload.trackWindow.currentTrack)) ||
			(payload.metadata && (payload.metadata.current_item || payload.metadata.track)) ||
			null;

		const candidate = directTrack || nestedTrack;
		if (!candidate || typeof candidate !== "object") {
			return "";
		}

		return candidate.name || candidate.title || "";
	}

	function extractSpotifyTrackUri(payload) {
		if (!payload || typeof payload !== "object") {
			return "";
		}

		const directTrack = payload.item || payload.track || payload.current_track || null;
		const nestedTrack =
			(payload.track_window && payload.track_window.current_track) ||
			(payload.trackWindow && (payload.trackWindow.current_track || payload.trackWindow.currentTrack)) ||
			(payload.metadata && (payload.metadata.current_item || payload.metadata.track)) ||
			null;

		const candidate = directTrack || nestedTrack;
		const rawUri =
			(candidate && (candidate.uri || candidate.external_urls?.spotify || candidate.link)) ||
			payload.uri ||
			payload.currentURI ||
			payload.current_uri ||
			"";

		return typeof rawUri === "string" ? rawUri : "";
	}

	async function applySpotifyTitleFromPayload(payload) {
		const directTitle = extractSpotifyTrackTitle(payload) || extractTitleFromUnknownPayload(payload);
		if (directTitle) {
			trackName = directTitle;
			trackTitle.textContent = directTitle;
			statusText.textContent = directTitle;
			hasLoadedTrack = true;
			updateMediaSessionMetadata();
			return directTitle;
		}

		const trackUri = extractSpotifyTrackUri(payload);
		const fetchedTitle = await fetchSpotifyTrackTitleFromUri(trackUri);
		if (fetchedTitle) {
			trackName = fetchedTitle;
			trackTitle.textContent = fetchedTitle;
			statusText.textContent = fetchedTitle;
			hasLoadedTrack = true;
			updateMediaSessionMetadata();
			return fetchedTitle;
		}

		return "";
	}

	controller.addListener("playback_update", (event) => {
		const data = event && event.data ? event.data : event || {};
		const titleUpdatePromise = applySpotifyTitleFromPayload(data);
		void titleUpdatePromise;

		const pausedState =
			typeof data.isPaused === "boolean"
				? data.isPaused
				: typeof data.paused === "boolean"
					? data.paused
					: null;

		if (pausedState !== null) {
			setDeckAnimation(!pausedState);
			if (pausedState) {
				statusText.textContent = "Spotify paused";
			} else {
				void titleUpdatePromise.then((resolvedTitle) => {
					statusText.textContent = resolvedTitle || trackName || "Spotify playing";
				});
			}
		}
	});

	controller.__mdPlaybackBound = true;
}

function renderSpotifyIframeFallback(embedUrl, resourceType) {
	if (!spotifyEmbed) {
		return;
	}

	spotifyEmbed.innerHTML = "";
	const iframe = document.createElement("iframe");
	iframe.title = "Spotify player";
	iframe.loading = "lazy";
	iframe.allow = "autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture";
	iframe.src = `${embedUrl}?utm_source=generator`;
	iframe.style.width = "100%";
	iframe.style.height = `${getSpotifyEmbedHeight(resourceType)}px`;
	iframe.style.border = "0";
	iframe.style.borderRadius = "10px";
	spotifyEmbed.appendChild(iframe);
	statusText.textContent = "Spotify loaded (visual sync limited)";
}

function getSpotifyEmbedHeight(resourceType) {
	const compactTypes = new Set(["track", "episode"]);
	return compactTypes.has(resourceType) ? 152 : 352;
}

function loadSpotifyEmbed(rawValue) {
	if (!spotifyEmbed) {
		return;
	}

	const resource = parseSpotifyResource(rawValue);
	if (!resource) {
		statusText.textContent = "Invalid Spotify link";
		return;
	}

	const resourceType = resource.type;
	const embedUrl = `https://open.spotify.com/embed/${resource.type}/${resource.id}`;

	trackName = "Spotify track loading...";
	hasLoadedTrack = true;
	trackTitle.textContent = trackName;
	statusText.textContent = trackName;
	updateMediaSessionMetadata();
	ensureSpotifyIframeApi()
		.then((iframeApi) => {
			if (spotifyController && typeof spotifyController.destroy === "function") {
				spotifyController.destroy();
			}

			spotifyEmbed.style.height = `${getSpotifyEmbedHeight(resourceType)}px`;
			spotifyEmbed.innerHTML = "";
			iframeApi.createController(
				spotifyEmbed,
				{
					uri: `spotify:${resource.type}:${resource.id}`,
					width: "100%",
					height: getSpotifyEmbedHeight(resourceType)
				},
				(controller) => {
					spotifyController = controller;
					bindSpotifyPlaybackUpdates(controller);
					statusText.textContent = "Spotify embed loaded";
				}
			);
		})
		.catch(() => {
			renderSpotifyIframeFallback(embedUrl, resourceType);
		});
}

function loadSpotifyEmbedFromInput() {
	if (!spotifyUrlInput) {
		return;
	}

	loadSpotifyEmbed(spotifyUrlInput.value);
}

function loadSpotifyEmbedByUrl(url) {
	if (!url || typeof url !== "string") {
		return false;
	}

	const cleanedUrl = url.trim();
	if (!cleanedUrl) {
		return false;
	}

	if (spotifyUrlInput) {
		spotifyUrlInput.value = cleanedUrl;
	}

	loadSpotifyEmbed(cleanedUrl);
	return true;
}

async function loadSpotifyFromClipboardIfNeeded() {
	if (!spotifyUrlInput) {
		return false;
	}

	if (spotifyUrlInput.value.trim()) {
		loadSpotifyEmbedFromInput();
		return true;
	}

	if (!navigator.clipboard || !window.isSecureContext) {
		statusText.textContent = "Paste a Spotify link first";
		return false;
	}

	try {
		const clipboardText = (await navigator.clipboard.readText()).trim();
		if (!clipboardText) {
			statusText.textContent = "Clipboard is empty";
			return false;
		}

		spotifyUrlInput.value = clipboardText;
		loadSpotifyEmbed(clipboardText);
		return true;
	} catch {
		statusText.textContent = "Clipboard blocked, paste link manually";
		return false;
	}
}

function getRandomPlaylistIndex() {
	if (playlist.length <= 1) {
		return playlistIndex;
	}

	let next = playlistIndex;
	while (next === playlistIndex) {
		next = Math.floor(Math.random() * playlist.length);
	}
	return next;
}

function updateModeButtonsUi() {
	if (shuffleBtn) {
		shuffleBtn.textContent = isShuffleEnabled ? "Shuffle On" : "Shuffle Off";
		shuffleBtn.setAttribute("aria-pressed", String(isShuffleEnabled));
		shuffleBtn.classList.toggle("active", isShuffleEnabled);
	}

	if (repeatBtn) {
		const isRepeatOn = repeatMode !== "off";
		repeatBtn.textContent = repeatMode === "one" ? "Repeat One" : isRepeatOn ? "Repeat All" : "Repeat Off";
		repeatBtn.setAttribute("aria-pressed", String(isRepeatOn));
		repeatBtn.classList.toggle("active", isRepeatOn);
	}
}

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
}

function updateFileNameLabel(file) {
	if (!fileNameText || !file) {
		return;
	}

	if (playlist.length > 1 && playlistIndex >= 0) {
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
		emptyItem.textContent = "Connect a folder to build playlist";
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
			folderHint.textContent = "Use a browser that supports folder access.";
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
			folderHint.textContent = "Access failed. Try again or choose local files.";
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
		if (isShuffleEnabled) {
			goToPlaylistTrack(getRandomPlaylistIndex(), true);
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
		if (isShuffleEnabled) {
			goToPlaylistTrack(getRandomPlaylistIndex(), true);
			return;
		}
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
	playPauseBtn.textContent = isPlaying ? "PAUSE" : "PLAY";
	statusText.textContent = isPlaying ? "Now Playing" : hasLoadedTrack ? "Ready" : "Not Launched";
	trackTitle.textContent = trackName;
	setDeckAnimation(isPlaying);
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

playPauseBtn.addEventListener("click", () => {
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
	setPlayingState(false);

	// Reset input so selecting the same file again still triggers change.
	if (trackFileInput) {
		trackFileInput.value = "";
	}
}

if (trackFileInput) {
	trackFileInput.addEventListener("change", (event) => {
		const files = Array.from(event.target.files || []);
		statusText.textContent = files.length ? "Local files selected" : "No audio files found";
		setPlaylist(files, 0, false);
	});
}

if (localFileBtn && trackFileInput) {
	localFileBtn.addEventListener("click", () => {
		trackFileInput.click();
	});
}

if (connectFolderBtn) {
	connectFolderBtn.addEventListener("click", () => {
		connectLaptopMusicFolder();
	});
}

if (spotifyLoadBtn) {
	spotifyLoadBtn.addEventListener("click", async () => {
		await loadSpotifyFromClipboardIfNeeded();
	});
}

if (spotifyUrlInput) {
	spotifyUrlInput.addEventListener("keydown", (event) => {
		if (event.key === "Enter") {
			event.preventDefault();
			loadSpotifyEmbedFromInput();
		}
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

if (shuffleBtn) {
	shuffleBtn.addEventListener("click", () => {
		isShuffleEnabled = !isShuffleEnabled;
		updateModeButtonsUi();
		statusText.textContent = isShuffleEnabled ? "Shuffle enabled" : "Shuffle disabled";
	});
}

if (repeatBtn) {
	repeatBtn.addEventListener("click", () => {
		if (repeatMode === "off") {
			repeatMode = "all";
		} else if (repeatMode === "all") {
			repeatMode = "one";
		} else {
			repeatMode = "off";
		}
		updateModeButtonsUi();
		statusText.textContent = repeatMode === "off" ? "Repeat off" : repeatMode === "one" ? "Repeat one" : "Repeat all";
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

audio.addEventListener("play", () => {
	setPlayingState(true);
});

audio.addEventListener("pause", () => {
	if (!audio.ended) {
		setPlayingState(false);
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
	if (repeatMode === "one" && playlist.length > 0) {
		goToPlaylistTrack(playlistIndex, true);
		return;
	}

	if (playlist.length > 1) {
		if (isShuffleEnabled) {
			goToPlaylistTrack(getRandomPlaylistIndex(), true);
			return;
		}

		if (playlistIndex < playlist.length - 1) {
			goToPlaylistTrack(playlistIndex + 1, true);
			return;
		}

		if (repeatMode === "all") {
			goToPlaylistTrack(0, true);
			return;
		}

		setPlayingState(false);
		setMediaPlaybackState(false);
		statusText.textContent = "Playlist finished";
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

window.mdVinylPlayer = {
	loadSpotifyEmbedByUrl,
	loadSpotifyEmbedFromInput,
	loadSpotifyFromClipboardIfNeeded,
};

setRangeProgress(seekBar, 0, 100);
setVolumeLevel(volumeLevel);
vinyl.classList.add("disc-black");
registerMediaSessionHandlers();
updateMediaSessionMetadata();
renderPlaylist();
updateModeButtonsUi();
setPlayingState(false);
