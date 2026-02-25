# FileOS - Web-based Operating System File Explorer

**FileOS** is a powerful, full-stack application designed to simulate the complex, native file management experience we are used to on Windows and macOS, built entirely for the web. 

This project goes beyond simple uploading and downloading by implementing an authentic "Virtual File System" on the backend, enabling features like native OS color tagging, soft-delete via a Recycle Bin, atomic "Undo" functionality, and smart file organization.

![FileOS Screenshot](https://github.com/kanhaiyak23/File_organizer/frontend/assets/placeholder.png) 

## 🌟 Key Features

### The File System Experience
*   **Virtual Drives:** Sandboxed backend architecture simulating multiple hard disk drives (`C:`, `D:`, `E:`).
*   **Advanced Navigation:** macOS Finder / Windows Explorer-style sidebar, fully interactive breadcrumbs, and switching between dynamic Grid & List views.
*   **Context Menus:** Right-click anywhere for native-feeling menus to open, rename, delete, preview, download, and organize files.
*   **Rich Previews:** Built-in modal viewer for Videos, Audio files, PDFs, and Images straight from the browser.
*   **Sort & Search:** Instantly sort by Name, Size, Type, or Date Modified, with an ascending/descending toggle and real-time name filtering.

### "Smart" Operations
*   **Intelligent Organization:** Click "Organize This Folder" to have the backend scan file extensions and automatically sort a messy directory into named subfolders (Images, Documents, Videos, etc.).
*   **Transactional Undo System:** Every organization action is recorded in a local `.undo_log.json` transaction state, allowing you to seamlessly 'Undo' and revert hundreds of files to their original directories in an instant.
*   **Conflict Resolution:** Drag-and-drop file uploads intelligently check for name collisions and present an interactive modal to Skip, Replace, or Keep Both (incremental renaming) for each individual conflict.

### macOS & Windows Native Features
*   **Recycle Bin (Soft Deletes):** Deleting files moves them to a hidden `.trash` directory instead of destroying them outright. Accompanying `.meta.json` records keep track of timestamps and original paths, allowing files to be perfectly restored.
*   **Color Tags:** Mirroring macOS functionality, users can right-click any item to assign global color dots (Red, Orange, Yellow, Green, Blue, Purple, Gray). Selecting a tag in the sidebar will query the system's `.tags.json` database to instantly filter and show all files sharing that tag across every virtual drive.

## 🛠️ Tech Stack

*   **Frontend:** React (Vite), native CSS (no heavy CSS frameworks!), `lucide-react` for beautiful native icons.
*   **Backend:** Node.js, Express, Multer, using the native `fs` module for complex file system operations.

## 🚀 Getting Started

### 1. Backend Server
The backend handles the virtual file paths, tagging engine, and express routes.
```bash
cd backend
npm install
npm run dev
```

### 2. Frontend Application
```bash
cd frontend
npm install
npm run dev
```

The application will be accessible at `http://localhost:5173/explorer` natively.

## 🏗️ Virtual Directory Architecture

Behind the scenes, the root directory mounts physical data into the virtual paths:

```text
/backend
  /data
    /C         -> Maps to exactly C:\ in the app
    /D         -> Maps to exactly D:\ in the app
  /.trash      -> Global recycle bin containing soft-deleted files
  /.tags.json  -> Document database for global color tags
  /.undo_log.json -> Records the last valid smart folder organization event
```
