import { useState, useEffect, useCallback } from 'react'
import { api, listenForUpdates } from './api'
import Sidebar from './components/Sidebar'
import FilterBar from './components/FilterBar'
import CardGrid from './components/CardGrid'
import DetailPanel from './components/DetailPanel'
import ContextMenu from './components/ContextMenu'
import DeleteModal from './components/DeleteModal'
import MoveModal from './components/MoveModal'
import PromptModal from './components/PromptModal'
import Toast from './components/Toast'
import StarPopup from './components/StarPopup'

export default function App() {
  const [files, setFiles] = useState([])
  const [favoriteFiles, setFavoriteFiles] = useState([])
  const [globalFavoriteCount, setGlobalFavoriteCount] = useState(0)
  const [stats, setStats] = useState(null)
  const [config, setConfig] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeFilter, setActiveFilter] = useState({ type: 'designs' })
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedFile, setSelectedFile] = useState(null)
  const [contextMenu, setContextMenu] = useState(null)
  const [toast, setToast] = useState(null)
  const [activeModal, setActiveModal] = useState(null)
  const [modalFile, setModalFile] = useState(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [rootDir, setRootDir] = useState('')
  const [globalProjects, setGlobalProjects] = useState([])
  const [pendingDir, setPendingDir] = useState(null)

  const applyData = useCallback((data) => {
    setFiles(data.files || [])
    setStats(data.stats || null)
    setConfig(data.config || null)
    if (typeof data.globalFavoritesCount === 'number') setGlobalFavoriteCount(data.globalFavoritesCount)
    if (data.rootDir) setRootDir(data.rootDir)
    if (data.projects) setGlobalProjects(data.projects)
  }, [])

  const loadFavorites = useCallback(async () => {
    const data = await api.getFavorites()
    setFavoriteFiles(data.files || [])
    setGlobalFavoriteCount(typeof data.count === 'number' ? data.count : (data.files || []).length)
  }, [])

  const loadData = useCallback(async () => {
    try {
      const [data, info, favorites] = await Promise.all([api.getFiles(), api.getInfo(), api.getFavorites()])
      applyData(data)
      if (info.rootDir) setRootDir(info.rootDir)
      if (info.projects) setGlobalProjects(info.projects)
      setFavoriteFiles(favorites.files || [])
      setGlobalFavoriteCount(typeof favorites.count === 'number' ? favorites.count : (favorites.files || []).length)
    } catch (e) {
      console.error('Failed to load data', e)
    } finally {
      setLoading(false)
    }
  }, [applyData])

  useEffect(() => {
    loadData()
    const cleanup = listenForUpdates((data) => {
      applyData(data)
      loadFavorites().catch(() => {})
    })
    return cleanup
  }, [loadData, applyData, loadFavorites])

  const showToast = useCallback((message, undoFn) => {
    setToast({ message, undoFn })
    setTimeout(() => setToast(null), 5000)
  }, [])

  const handleToggleFavorite = async (file) => {
    const targetRoot = file.sourceRootDir || rootDir
    const nextFavorite = !file.favorite

    setFiles((prev) => prev.map((f) => (f.id === file.id && (f.sourceRootDir || rootDir) === targetRoot ? { ...f, favorite: nextFavorite } : f)))
    setFavoriteFiles((prev) => {
      const existing = prev.some((f) => f.id === file.id && f.sourceRootDir === targetRoot)
      if (nextFavorite) {
        return existing ? prev : [{ ...file, favorite: true, sourceRootDir: targetRoot }, ...prev]
      }
      return prev.filter((f) => !(f.id === file.id && f.sourceRootDir === targetRoot))
    })
    setGlobalFavoriteCount((prev) => Math.max(0, prev + (nextFavorite ? 1 : -1)))
    setSelectedFile((prev) => (prev?.id === file.id && (prev.sourceRootDir || rootDir) === targetRoot ? { ...prev, favorite: nextFavorite } : prev))
    await api.toggleFavorite(file.id, targetRoot)
    await loadFavorites()
  }

  const handleDelete = (file) => {
    setModalFile(file)
    setActiveModal('delete')
  }

  const handleConfirmDelete = async () => {
    if (!modalFile) return
    const fileId = modalFile.id
    const targetRoot = modalFile.sourceRootDir || rootDir
    const data = await api.deleteFile(fileId, targetRoot)
    if (data.files) {
      setFiles(data.files || [])
      setStats(data.stats || null)
    }
    setActiveModal(null)
    if (selectedFile?.id === fileId) setSelectedFile(null)
    await loadFavorites()
    showToast(`Deleted ${modalFile.filename}`, async () => {
      const restored = await api.restoreFile(fileId, targetRoot)
      if (restored.files) {
        setFiles(restored.files || [])
        setStats(restored.stats || null)
      }
      await loadFavorites()
    })
  }

  const handleMove = (file) => {
    setModalFile(file)
    setActiveModal('move')
  }

  const handleDuplicate = async (file) => {
    const data = await api.duplicateFile(file.id, file.sourceRootDir || rootDir)
    if (data.files) {
      setFiles(data.files || [])
      setStats(data.stats || null)
    }
    await loadFavorites()
    showToast(`Duplicated ${file.filename}`)
  }

  const handleRename = async (file, newName) => {
    const data = await api.renameFile(file.id, newName, file.sourceRootDir || rootDir)
    if (data.files) {
      setFiles(data.files || [])
      setStats(data.stats || null)
    }
    if (selectedFile?.id === file.id && data.files) {
      const updated = data.files.find((f) => f.name === newName)
      if (updated) setSelectedFile(updated)
    }
    await loadFavorites()
  }

  const updateFileAndSelection = (id, patch) => {
    setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)))
    setSelectedFile((prev) => (prev?.id === id ? { ...prev, ...patch } : prev))
  }

  const targetRootForId = (id) => {
    if (selectedFile?.id === id && selectedFile?.sourceRootDir) return selectedFile.sourceRootDir
    if (modalFile?.id === id && modalFile?.sourceRootDir) return modalFile.sourceRootDir
    return rootDir
  }

  const handleSetStatus = async (id, status) => {
    updateFileAndSelection(id, { status })
    await api.setStatus(id, status, targetRootForId(id))
    await loadFavorites()
  }

  const handleSetTags = async (id, tags) => {
    updateFileAndSelection(id, { tags })
    await api.setTags(id, tags, targetRootForId(id))
    await loadFavorites()
  }

  const handleSetNote = async (id, note) => {
    updateFileAndSelection(id, { note })
    await api.setNote(id, note, targetRootForId(id))
    await loadFavorites()
  }

  const handleSetProject = async (id, project) => {
    updateFileAndSelection(id, { project })
    await api.setProject(id, project, targetRootForId(id))
    await loadFavorites()
  }

  const handleRescan = async () => {
    const prevCount = files.length
    const data = await api.rescan()
    setFiles(data.files || [])
    setStats(data.stats || null)
    setConfig(data.config || null)
    await loadFavorites()
    const newCount = (data.files || []).length
    const diff = newCount - prevCount
    const itemLabel = data.stats.mode === 'routes' ? 'pages' : 'files'
    let msg = `Scanned — found ${data.stats.totalFiles} ${itemLabel} (${data.stats.versionStacks} version stacks)`
    if (diff > 0) msg += ` · ${diff} new`
    else if (diff < 0) msg += ` · ${Math.abs(diff)} removed`
    showToast(msg)
  }

  const handleChangeDir = async (newDir, customName) => {
    const isKnown = globalProjects.some((p) => p.directory === newDir)

    if (!isKnown && !customName) {
      setPendingDir(newDir)
      return
    }

    await switchToDir(newDir, customName)
  }

  const switchToDir = async (dir, name) => {
    const folderName = name || dir.split('/').filter(Boolean).pop() || dir
    setLoading(true)
    try {
      const data = await api.changeDir(dir, name)
      applyData(data)
      await loadFavorites()
      setSelectedFile(null)
      setActiveFilter({ type: 'designs' })
      setSearchQuery('')
      showToast(`Switched to ${folderName}`)
    } catch (e) {
      showToast(e.message || 'Failed to change directory')
    } finally {
      setLoading(false)
    }
  }

  const handleRenameProject = async (directory, newName) => {
    const data = await api.renameProject(directory, newName)
    setGlobalProjects(data.projects || [])
  }

  const handleSwitchProject = async (directory) => {
    if (directory === rootDir) return
    await handleChangeDir(directory)
  }

  const handleRemoveProject = async (directory) => {
    const data = await api.removeProject(directory)
    setGlobalProjects(data.projects || [])
    await loadFavorites()
    showToast('Project removed')
  }

  // Filtering
  const sourceFiles = activeFilter.type === 'favorites' ? favoriteFiles : files

  const filteredFiles = sourceFiles.filter((f) => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      const matchesName = f.name.toLowerCase().includes(q)
      const matchesTags = (f.tags || []).some((t) => t.toLowerCase().includes(q))
      const matchesProject = (f.project || '').toLowerCase().includes(q)
      if (!matchesName && !matchesTags && !matchesProject) return false
    }

    const { type, value } = activeFilter
    if (type === 'all') return true
    if (type === 'designs') return f.previewable
    if (type === 'code') return !f.previewable
    if (type === 'favorites') return true
    if (type === 'recent') return true // handled by sort below
    if (type === 'extension') return f.extension === value
    if (type === 'project') return f.project === value
    if (type === 'status') return f.status === value
    return true
  })

  let displayFiles = [...filteredFiles]
  if (activeFilter.type === 'recent') {
    displayFiles.sort((a, b) => new Date(b.modifiedAt) - new Date(a.modifiedAt))
    displayFiles = displayFiles.slice(0, 10)
  }

  return (
    <div className="app-layout">
      <Sidebar
        files={files}
        globalFavoriteCount={globalFavoriteCount}
        config={config}
        activeFilter={activeFilter}
        onFilter={setActiveFilter}
        onProjectDrop={handleSetProject}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onUpdateConfig={(cfg) => setConfig(cfg)}
        globalProjects={globalProjects}
        rootDir={rootDir}
        onSwitchProject={handleSwitchProject}
        onRemoveProject={handleRemoveProject}
        onAddProject={handleChangeDir}
        onRenameProject={handleRenameProject}
      />

      <div className="main-content">
        <FilterBar
          searchQuery={searchQuery}
          onSearch={setSearchQuery}
          stats={stats}
          onHamburger={() => setSidebarOpen(true)}
          onRescan={handleRescan}
          rootDir={rootDir}
          onChangeDir={handleChangeDir}
        />

        <div className="main-scroll">
          <div className="content-shell">
            <CardGrid
              files={displayFiles}
              loading={loading}
              onSelect={setSelectedFile}
              onContextMenu={setContextMenu}
              onToggleFavorite={handleToggleFavorite}
              onChangeDir={handleChangeDir}
            />
          </div>
        </div>
      </div>

      {selectedFile && (
        <DetailPanel
          file={selectedFile}
          onClose={() => setSelectedFile(null)}
          onRename={handleRename}
          onSetStatus={handleSetStatus}
          onSetTags={handleSetTags}
          onSetNote={handleSetNote}
          onDelete={handleDelete}
          onDuplicate={handleDuplicate}
          onMove={handleMove}
          showToast={showToast}
        />
      )}

      {contextMenu && (
        <ContextMenu
          {...contextMenu}
          onClose={() => setContextMenu(null)}
          onSelect={setSelectedFile}
          onDelete={handleDelete}
          onDuplicate={handleDuplicate}
          onMove={handleMove}
          onRename={(f) => {
            setSelectedFile(f)
            setContextMenu(null)
          }}
          showToast={showToast}
        />
      )}

      {activeModal === 'delete' && modalFile && (
        <DeleteModal
          file={modalFile}
          onClose={() => setActiveModal(null)}
          onConfirm={handleConfirmDelete}
        />
      )}

      {activeModal === 'move' && modalFile && (
        <MoveModal
          file={modalFile}
          config={config}
          onClose={() => setActiveModal(null)}
          onMove={async (project) => {
            await handleSetProject(modalFile.id, project)
            setActiveModal(null)
            showToast(`Moved to ${project}`)
          }}
        />
      )}

      {pendingDir && (
        <PromptModal
          title="Name this project"
          label={pendingDir}
          defaultValue={pendingDir.split('/').filter(Boolean).pop() || ''}
          onConfirm={(name) => {
            const dir = pendingDir
            setPendingDir(null)
            switchToDir(dir, name)
          }}
          onCancel={() => setPendingDir(null)}
        />
      )}

      {toast && (
        <Toast
          message={toast.message}
          undoFn={toast.undoFn}
          onDismiss={() => setToast(null)}
        />
      )}

      <StarPopup />
    </div>
  )
}
