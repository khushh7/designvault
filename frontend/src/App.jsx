import { useState, useEffect, useCallback } from 'react'
import { api, listenForUpdates } from './api'
import Sidebar from './components/Sidebar'
import FilterBar from './components/FilterBar'
import CardGrid from './components/CardGrid'
import DetailPanel from './components/DetailPanel'
import ContextMenu from './components/ContextMenu'
import DeleteModal from './components/DeleteModal'
import MoveModal from './components/MoveModal'
import Toast from './components/Toast'

export default function App() {
  const [files, setFiles] = useState([])
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

  const applyData = useCallback((data) => {
    setFiles(data.files || [])
    setStats(data.stats || null)
    setConfig(data.config || null)
    if (data.rootDir) setRootDir(data.rootDir)
    if (data.projects) setGlobalProjects(data.projects)
  }, [])

  const loadData = useCallback(async () => {
    try {
      const [data, info] = await Promise.all([api.getFiles(), api.getInfo()])
      applyData(data)
      if (info.rootDir) setRootDir(info.rootDir)
      if (info.projects) setGlobalProjects(info.projects)
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
    })
    return cleanup
  }, [loadData, applyData])

  const showToast = useCallback((message, undoFn) => {
    setToast({ message, undoFn })
    setTimeout(() => setToast(null), 5000)
  }, [])

  const handleToggleFavorite = async (id) => {
    setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, favorite: !f.favorite } : f)))
    setSelectedFile((prev) => (prev?.id === id ? { ...prev, favorite: !prev.favorite } : prev))
    const cfg = await api.toggleFavorite(id)
    setConfig(cfg)
  }

  const handleDelete = (file) => {
    setModalFile(file)
    setActiveModal('delete')
  }

  const handleConfirmDelete = async () => {
    if (!modalFile) return
    const fileId = modalFile.id
    const data = await api.deleteFile(fileId)
    setFiles(data.files || [])
    setStats(data.stats || null)
    setActiveModal(null)
    if (selectedFile?.id === fileId) setSelectedFile(null)
    showToast(`Deleted ${modalFile.filename}`, async () => {
      const restored = await api.restoreFile(fileId)
      setFiles(restored.files || [])
      setStats(restored.stats || null)
    })
  }

  const handleMove = (file) => {
    setModalFile(file)
    setActiveModal('move')
  }

  const handleDuplicate = async (file) => {
    const data = await api.duplicateFile(file.id)
    setFiles(data.files || [])
    setStats(data.stats || null)
    showToast(`Duplicated ${file.filename}`)
  }

  const handleRename = async (file, newName) => {
    const data = await api.renameFile(file.id, newName)
    setFiles(data.files || [])
    setStats(data.stats || null)
    if (selectedFile?.id === file.id) {
      const updated = data.files.find((f) => f.name === newName)
      if (updated) setSelectedFile(updated)
    }
  }

  const updateFileAndSelection = (id, patch) => {
    setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)))
    setSelectedFile((prev) => (prev?.id === id ? { ...prev, ...patch } : prev))
  }

  const handleSetStatus = async (id, status) => {
    updateFileAndSelection(id, { status })
    await api.setStatus(id, status)
  }

  const handleSetTags = async (id, tags) => {
    updateFileAndSelection(id, { tags })
    await api.setTags(id, tags)
  }

  const handleSetNote = async (id, note) => {
    updateFileAndSelection(id, { note })
    await api.setNote(id, note)
  }

  const handleSetProject = async (id, project) => {
    updateFileAndSelection(id, { project })
    await api.setProject(id, project)
  }

  const handleRescan = async () => {
    const prevCount = files.length
    const data = await api.rescan()
    setFiles(data.files || [])
    setStats(data.stats || null)
    setConfig(data.config || null)
    const newCount = (data.files || []).length
    const diff = newCount - prevCount
    const itemLabel = data.stats.mode === 'routes' ? 'pages' : 'files'
    let msg = `Scanned — found ${data.stats.totalFiles} ${itemLabel} (${data.stats.versionStacks} version stacks)`
    if (diff > 0) msg += ` · ${diff} new`
    else if (diff < 0) msg += ` · ${Math.abs(diff)} removed`
    showToast(msg)
  }

  const handleChangeDir = async (newDir) => {
    setLoading(true)
    try {
      const data = await api.changeDir(newDir)
      applyData(data)
      setSelectedFile(null)
      setActiveFilter({ type: 'designs' })
      setSearchQuery('')
      const folderName = (data.rootDir || newDir).split('/').filter(Boolean).pop()
      showToast(`Switched to ${folderName}`)
    } catch (e) {
      showToast(e.message || 'Failed to change directory')
    } finally {
      setLoading(false)
    }
  }

  const handleSwitchProject = async (directory) => {
    if (directory === rootDir) return
    await handleChangeDir(directory)
  }

  const handleRemoveProject = async (directory) => {
    const data = await api.removeProject(directory)
    setGlobalProjects(data.projects || [])
    showToast('Project removed')
  }

  // Filtering
  const filteredFiles = files.filter((f) => {
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
    if (type === 'favorites') return f.favorite
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
          <CardGrid
            files={displayFiles}
            loading={loading}
            onSelect={setSelectedFile}
            onContextMenu={setContextMenu}
            onToggleFavorite={handleToggleFavorite}
          />
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

      {toast && (
        <Toast
          message={toast.message}
          undoFn={toast.undoFn}
          onDismiss={() => setToast(null)}
        />
      )}
    </div>
  )
}
