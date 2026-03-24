import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import Playlist from './components/Playlist.js';
import TrackList from './components/TrackList.js';
import Player from './components/Player.js';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Playlist />} />
        <Route path="/playlist/:id" element={<TrackList />} />
        <Route path="/player" element={<Player />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
