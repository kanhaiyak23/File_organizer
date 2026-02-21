# File Organizer - OS File System Simulation

A file management app that simulates how an Operating System manages and organizes files.

## Features

- **Upload & categorize** – Files auto-organize into Documents, Images, Videos, Audio, Others
- **Desktop-like UI** – Sidebar navigation, grid/list view, drag & drop (Windows Explorer / macOS Finder feel)
- **Search** – Filter files by name
- **Sort** – By name, size, or date
- **File preview** – Images, videos, audio, PDFs in a modal
- **Dark/Light mode** – Toggle with persistence
- **Context menu** – Right-click for Preview, Details, Download, Rename, Delete
- **Real-time updates** – WebSocket syncs uploads/deletes across clients
- **CRUD** – Rename, delete, download, view details
- **OS concepts** – File storage, inodes, directory hierarchy, metadata

## Tech Stack

- **Frontend**: React, Tailwind CSS, Framer Motion, Lucide Icons
- **Backend**: Node.js, Express, Multer, fs

## Run

```bash
# Terminal 1 – Backend
cd backend && npm start

# Terminal 2 – Frontend
cd frontend && npm run dev
```

Open http://localhost:5173 (Backend runs on port 3002)

## Directory Structure (Backend)

```
/uploads
  /documents   (.pdf, .doc, .txt, ...)
  /images      (.jpg, .png, ...)
  /videos      (.mp4, .mov, ...)
  /audio       (.mp3, .wav, ...)
  /others
```
