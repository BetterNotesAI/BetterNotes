'use client';

import Link from 'next/link';
import Image from 'next/image';
import { createPortal } from 'react-dom';
import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

interface RecentDoc { id: string; title: string }

interface SidebarFolder {
  id: string;
  name: string;
  color: string | null;
  is_starred: boolean;
  document_count: number;
  input_count?: number;
  archived_at?: string | null;
  created_at: string;
}

interface SidebarFolderDoc {
  id: string;
  title: string;
}

interface UsageSnapshot {
  plan: string;
  message_count: number;
  limit: number;
  remaining: number;
  credits_used?: number;
  credits_limit?: number;
  credits_remaining?: number;
}

const COLLAPSED_KEY = 'bn_sidebar_collapsed';
const RECENTS_VISIBLE_KEY = 'bn_sidebar_recents_visible';
const EDITOR_PREFIX = '/documents/';
const MAX_FOLDERS_VISIBLE = 5;
const MAX_VISIBLE_FOLDER_DOCS = 4;

const PRESET_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e',
  '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#3b82f6', '#94a3b8',
];

// ── Section divider component ────────────────────────────────────────────────
function SectionDivider({ label, collapsed }: { label: string; collapsed: boolean }) {
  if (collapsed) {
    return <div className="my-2 mx-2 h-px bg-white/10" />;
  }
  return (
    <div className="flex items-center gap-2 px-2 pt-4 pb-1.5">
      <div className="flex-1 h-px bg-white/10" />
      <span className="text-[10px] font-semibold text-white/42 uppercase tracking-widest whitespace-nowrap">
        {label}
      </span>
      <div className="flex-1 h-px bg-white/10" />
    </div>
  );
}

// ── Placeholder nav item ─────────────────────────────────────────────────────
function PlaceholderNavItem({
  href,
  icon,
  label,
  collapsed,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  collapsed: boolean;
}) {
  return (
    <Link
      href={href}
      title={collapsed ? `${label} (Coming soon)` : undefined}
      className={`flex items-center gap-3 rounded-xl transition-colors duration-150 opacity-65 hover:opacity-85 ${
        collapsed ? 'justify-center px-2 py-2.5' : 'px-3 py-2.5'
      } text-white/55 hover:bg-white/5 hover:text-white/75`}
    >
      {icon}
      {!collapsed && (
        <span className="flex items-center gap-2 min-w-0 flex-1">
          <span className="text-sm truncate">{label}</span>
          <span className="shrink-0 text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-white/10 text-white/55 uppercase tracking-wide leading-none">
            Soon
          </span>
        </span>
      )}
    </Link>
  );
}

export function Sidebar() {
  const pathname = usePathname() ?? '';
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(true);
  const [userToggled, setUserToggled] = useState(false);
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [universityName, setUniversityName] = useState<string | null>(null);
  const [profileYear, setProfileYear] = useState<number | null>(null);
  const [recentDocs, setRecentDocs] = useState<RecentDoc[]>([]);
  const [recentsVisible, setRecentsVisible] = useState(true);
  const [folders, setFolders] = useState<SidebarFolder[]>([]);
  const [docsExpanded, setDocsExpanded] = useState(true);
  const [activeFolderIdInSidebar, setActiveFolderIdInSidebar] = useState<string | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  // Folder CRUD state
  const [creatingFolderParentId, setCreatingFolderParentId] = useState<string | null>(null);
  const [newFolderName, setNewFolderName] = useState('');
  const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null);
  const [renameName, setRenameName] = useState('');
  const [expandedFolderIds, setExpandedFolderIds] = useState<Set<string>>(new Set());
  const [folderDocsById, setFolderDocsById] = useState<Record<string, SidebarFolderDoc[]>>({});
  const [folderDocsLoadingById, setFolderDocsLoadingById] = useState<Record<string, boolean>>({});
  const [folderMenuFolderId, setFolderMenuFolderId] = useState<string | null>(null);
  const [folderMenuPos, setFolderMenuPos] = useState<{ top: number; left: number } | null>(null);
  const [colorPickerFolderId, setColorPickerFolderId] = useState<string | null>(null);
  const [colorPickerPos, setColorPickerPos] = useState<{ top: number; left: number } | null>(null);
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const [feedbackSuccess, setFeedbackSuccess] = useState<string | null>(null);
  const [usage, setUsage] = useState<UsageSnapshot | null>(null);
  const [isGuest, setIsGuest] = useState(false);

  const newFolderInputRef = useRef<HTMLInputElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const feedbackTextareaRef = useRef<HTMLTextAreaElement>(null);

  // Hydrate from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(COLLAPSED_KEY);
    if (stored !== null) setCollapsed(stored === 'true');
    const storedRecents = localStorage.getItem(RECENTS_VISIBLE_KEY);
    if (storedRecents !== null) setRecentsVisible(storedRecents === 'true');
  }, []);

  useEffect(() => {
    localStorage.setItem(COLLAPSED_KEY, String(collapsed));
  }, [collapsed]);

  useEffect(() => {
    localStorage.setItem(RECENTS_VISIBLE_KEY, String(recentsVisible));
  }, [recentsVisible]);

  useEffect(() => {
    if (pathname.startsWith(EDITOR_PREFIX)) {
      if (!userToggled) setCollapsed(true);
    } else {
      setUserToggled(false);
    }
    if (!pathname.startsWith('/documents')) {
      setActiveFolderIdInSidebar(null);
    }
  }, [pathname, userToggled]);

  useEffect(() => {
    let ignore = false;

    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (ignore) return;
      if (data.user?.id) setUserId(data.user.id);
      if (data.user?.email) setEmail(data.user.email);
      const rawName = data.user?.user_metadata?.full_name ?? data.user?.user_metadata?.name;
      if (typeof rawName === 'string') setDisplayName(rawName);
    });

    fetch('/api/settings')
      .then((r) => (r.ok ? r.json() : null))
      .then((data: {
        profile?: {
          email?: string | null;
          display_name?: string | null;
          username?: string | null;
          avatar_url?: string | null;
          university?: string | null;
          profile_year?: number | null;
        };
      } | null) => {
        if (ignore || !data?.profile) return;
        if (data.profile.email) setEmail(data.profile.email);
        if (data.profile.display_name) setDisplayName(data.profile.display_name);
        if (data.profile.username) setUsername(data.profile.username);
        if (data.profile.avatar_url) setAvatarUrl(data.profile.avatar_url);
        if (data.profile.university) setUniversityName(data.profile.university);
        if (data.profile.profile_year) setProfileYear(data.profile.profile_year);
      })
      .catch(() => {});

    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    fetch('/api/documents')
      .then(r => r.ok ? r.json() : { documents: [] })
      .then(data => setRecentDocs((data.documents ?? []).slice(0, 5)))
      .catch(() => {});
  }, []);

  useEffect(() => {
    let ignore = false;

    async function loadUsage() {
      try {
        const resp = await fetch('/api/usage');
        if (!resp.ok) return;
        const data = await resp.json() as UsageSnapshot;
        if (!ignore) setUsage(data);
      } catch {
        // Non-fatal for sidebar UI
      }
    }

    void loadUsage();
    const interval = setInterval(() => void loadUsage(), 45000);

    return () => {
      ignore = true;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    let ignore = false;

    async function loadGuestStatus() {
      try {
        const resp = await fetch('/api/guest-status');
        if (!resp.ok) return;
        const data = await resp.json() as { is_guest?: boolean };
        if (!ignore) {
          setIsGuest(Boolean(data.is_guest));
        }
      } catch {
        // Non-fatal for sidebar UI
      }
    }

    void loadGuestStatus();

    return () => {
      ignore = true;
    };
  }, []);

  function loadFolders() {
    fetch('/api/folders', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : { folders: [] })
      .then(data => {
        const sorted: SidebarFolder[] = (data.folders ?? [])
          .sort((a: SidebarFolder, b: SidebarFolder) => {
            if (a.is_starred !== b.is_starred) return a.is_starred ? -1 : 1;
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
          });
        setFolders(sorted);
      })
      .catch(() => {});
  }

  useEffect(() => {
    function handleFoldersUpdated(e: Event) {
      const detail = (e as CustomEvent<{
        folderId?: string;
        updates?: Partial<SidebarFolder>;
      }>).detail;

      if (detail?.folderId && detail.updates) {
        setFolders(prev => prev.map(folder => (
          folder.id === detail.folderId
            ? { ...folder, ...detail.updates }
            : folder
        )));
      }

      loadFolders();
    }

    loadFolders();
    window.addEventListener('folders:updated', handleFoldersUpdated);
    return () => window.removeEventListener('folders:updated', handleFoldersUpdated);
  }, []);

  useEffect(() => {
    function onActivate(e: Event) {
      const folderId = (e as CustomEvent<{ folderId: string }>).detail.folderId;
      setActiveFolderIdInSidebar(folderId);
    }
    function onReset() {
      setActiveFolderIdInSidebar(null);
    }
    window.addEventListener('folder:activate', onActivate);
    window.addEventListener('folder:reset', onReset);
    return () => {
      window.removeEventListener('folder:activate', onActivate);
      window.removeEventListener('folder:reset', onReset);
    };
  }, []);

  useEffect(() => {
    if (!profileOpen) return;
    function handler(e: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [profileOpen]);

  // Close color picker on outside click
  useEffect(() => {
    if (!colorPickerFolderId) return;
    function handler(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-color-picker]') && !target.closest('[data-color-dot]')) {
        setColorPickerFolderId(null);
        setColorPickerPos(null);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [colorPickerFolderId]);

  // Close folder menu on outside click
  useEffect(() => {
    if (!folderMenuFolderId) return;
    function handler(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-folder-menu]') && !target.closest('[data-folder-menu-button]')) {
        setFolderMenuFolderId(null);
        setFolderMenuPos(null);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [folderMenuFolderId]);

  // Auto-focus inputs when they appear
  useEffect(() => {
    if (creatingFolderParentId) newFolderInputRef.current?.focus();
  }, [creatingFolderParentId]);

  useEffect(() => {
    if (renamingFolderId) renameInputRef.current?.focus();
  }, [renamingFolderId]);

  useEffect(() => {
    if (!isFeedbackOpen) return;
    setTimeout(() => feedbackTextareaRef.current?.focus(), 0);
  }, [isFeedbackOpen]);

  useEffect(() => {
    if (!isFeedbackOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && !isSubmittingFeedback) {
        setIsFeedbackOpen(false);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isFeedbackOpen, isSubmittingFeedback]);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/');
  }

  function toggle() {
    setUserToggled(true);
    setCollapsed(c => !c);
  }

  function isActiveDocuments() {
    return pathname === '/documents' || pathname.startsWith('/documents/');
  }

  function isActive(href: string) {
    if (href === '/home') return pathname === '/home';
    return pathname.startsWith(href);
  }

  function navigateToFolder(folder: SidebarFolder) {
    localStorage.setItem('bn_active_folder', folder.id);
    window.dispatchEvent(new CustomEvent('folder:activate', { detail: { folderId: folder.id } }));
    router.push('/documents');
  }

  function handleCreateProject() {
    // Navigate to the setup page; the folder is created only when the user
    // fills in the form and clicks Continue (see app/(app)/projects/new/page.tsx).
    router.push('/projects/new');
  }

  // ── Folder CRUD ─────────────────────────────────────────────

  async function handleCreateFolder() {
    const name = newFolderName.trim();
    if (!name) {
      setCreatingFolderParentId(null);
      setNewFolderName('');
      return;
    }
    const res = await fetch('/api/folders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    if (res.ok) {
      setCreatingFolderParentId(null);
      setNewFolderName('');
      loadFolders();
      window.dispatchEvent(new Event('folders:updated'));
    }
  }

  async function handleRenameFolder(id: string) {
    const name = renameName.trim();
    setRenamingFolderId(null);
    if (!name) return;
    const previous = folders.find(f => f.id === id)?.name ?? '';
    setFolders(prev => prev.map(f => f.id === id ? { ...f, name } : f));
    const res = await fetch(`/api/folders/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) {
      setFolders(prev => prev.map(f => f.id === id ? { ...f, name: previous } : f));
    } else {
      window.dispatchEvent(new CustomEvent('folders:updated', {
        detail: { folderId: id, updates: { name } },
      }));
    }
  }

  async function handleColorChange(id: string, color: string) {
    closeFolderMenu();
    setColorPickerFolderId(null);
    setColorPickerPos(null);
    const previous = folders.find(f => f.id === id)?.color ?? null;
    setFolders(prev => prev.map(f => f.id === id ? { ...f, color } : f));
    const res = await fetch(`/api/folders/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ color }),
    });
    if (!res.ok) {
      setFolders(prev => prev.map(f => f.id === id ? { ...f, color: previous } : f));
    } else {
      window.dispatchEvent(new CustomEvent('folders:updated', {
        detail: { folderId: id, updates: { color } },
      }));
    }
  }

  async function handleDeleteFolder(id: string) {
    closeFolderMenu();
    setFolders(prev => prev.filter(f => f.id !== id));
    await fetch(`/api/folders/${id}`, { method: 'DELETE' });
    window.dispatchEvent(new Event('folders:updated'));
  }

  function openColorPicker(id: string, dotEl: HTMLElement) {
    const rect = dotEl.getBoundingClientRect();
    setColorPickerFolderId(id);
    setColorPickerPos({ top: rect.bottom + 6, left: rect.left });
  }

  function closeFolderMenu() {
    setFolderMenuFolderId(null);
    setFolderMenuPos(null);
  }

  function openFolderMenu(id: string, buttonEl: HTMLElement) {
    const rect = buttonEl.getBoundingClientRect();
    setFolderMenuFolderId(id);
    setFolderMenuPos({
      top: rect.bottom + 6,
      left: Math.max(8, rect.right - 176),
    });
  }

  function startCreateFolderInside(id: string) {
    closeFolderMenu();
    setCreatingFolderParentId(id);
    setNewFolderName('');
    setExpandedFolderIds(prev => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }

  async function toggleFolderPin(folder: SidebarFolder) {
    closeFolderMenu();
    const nextPinned = !folder.is_starred;
    setFolders(prev => prev.map(f => (
      f.id === folder.id
        ? { ...f, is_starred: nextPinned }
        : f
    )));
    const res = await fetch(`/api/folders/${folder.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_starred: nextPinned }),
    });
    if (!res.ok) {
      setFolders(prev => prev.map(f => (
        f.id === folder.id
          ? { ...f, is_starred: folder.is_starred }
          : f
      )));
    } else {
      loadFolders();
      window.dispatchEvent(new CustomEvent('folders:updated', {
        detail: { folderId: folder.id, updates: { is_starred: nextPinned } },
      }));
    }
  }

  async function loadFolderDocuments(folderId: string) {
    if (folderDocsLoadingById[folderId]) return;
    setFolderDocsLoadingById(prev => ({ ...prev, [folderId]: true }));
    try {
      const response = await fetch(`/api/documents?sort=date_desc&folder_id=${encodeURIComponent(folderId)}`);
      const data = response.ok ? await response.json() : { documents: [] };
      const docs = Array.isArray(data.documents)
        ? data.documents.map((doc: { id?: string; title?: string }) => ({
          id: String(doc.id ?? ''),
          title: String(doc.title ?? 'Untitled'),
        })).filter((doc: SidebarFolderDoc) => doc.id.length > 0)
        : [];
      setFolderDocsById(prev => ({ ...prev, [folderId]: docs }));
    } catch {
      setFolderDocsById(prev => ({ ...prev, [folderId]: [] }));
    } finally {
      setFolderDocsLoadingById(prev => ({ ...prev, [folderId]: false }));
    }
  }

  function toggleFolderExpanded(folderId: string) {
    const isExpanded = expandedFolderIds.has(folderId);
    if (!isExpanded && folderDocsById[folderId] === undefined) {
      void loadFolderDocuments(folderId);
    }
    setExpandedFolderIds(prev => {
      const next = new Set(prev);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return next;
    });
  }

  function handleCreateDocumentInFolder(folderId: string) {
    closeFolderMenu();
    if (pathname.startsWith('/documents')) {
      window.dispatchEvent(new CustomEvent('folder:create-document', { detail: { folderId } }));
      return;
    }
    router.push(`/documents?new=1&folder=${encodeURIComponent(folderId)}`);
  }

  function openFeedbackModal() {
    setIsFeedbackOpen(true);
    setFeedbackError(null);
    setFeedbackSuccess(null);
  }

  function closeFeedbackModal() {
    if (isSubmittingFeedback) return;
    setIsFeedbackOpen(false);
  }

  async function handleSubmitFeedback(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const message = feedbackMessage.trim();
    if (message.length < 5) {
      setFeedbackError('Please write at least 5 characters.');
      setFeedbackSuccess(null);
      return;
    }
    if (message.length > 2000) {
      setFeedbackError('Feedback is too long (max 2000 chars).');
      setFeedbackSuccess(null);
      return;
    }

    setIsSubmittingFeedback(true);
    setFeedbackError(null);
    setFeedbackSuccess(null);
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          pagePath: pathname,
          source: 'sidebar',
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(data.error ?? 'Failed to send feedback');
      }

      setFeedbackMessage('');
      setFeedbackSuccess('Thanks. Your feedback has been sent.');
    } catch (err) {
      setFeedbackError(err instanceof Error ? err.message : 'Failed to send feedback');
    } finally {
      setIsSubmittingFeedback(false);
    }
  }

  const profileLabel = displayName || username || (email ? email.split('@')[0] : 'User');
  const initial = profileLabel ? profileLabel[0].toUpperCase() : 'U';
  const visibleEmail = email || 'No email';
  const visibleFolders = folders.slice(0, MAX_FOLDERS_VISIBLE);
  const hasMoreFolders = folders.length > MAX_FOLDERS_VISIBLE;
  const activeNavClass = 'bg-white/12 text-white font-medium ring-1 ring-indigo-300/30 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]';
  const aiResourceInactiveNavClass = 'text-white/90 font-medium bg-indigo-500/10 border border-indigo-300/20 hover:bg-indigo-500/16 hover:border-indigo-300/35 hover:text-white';
  const aiResourceActiveNavClass = 'bg-gradient-to-r from-indigo-500/35 to-violet-500/25 text-white font-semibold border border-indigo-300/55 shadow-[inset_0_1px_0_rgba(255,255,255,0.14)]';
  const creditsUsed = usage ? usage.credits_used ?? usage.message_count : 0;
  const creditsLimit = usage ? usage.credits_limit ?? usage.limit : 0;
  const creditsRemaining = usage
    ? Math.max(0, usage.credits_remaining ?? creditsLimit - creditsUsed)
    : 0;
  const creditsProgress = creditsLimit > 0
    ? Math.min(100, Math.max(0, Math.round((creditsRemaining / creditsLimit) * 100)))
    : 0;
  const billingHref = isGuest
    ? '/signup?returnUrl=%2Fsettings%2Fbilling&reason=billing_account_required'
    : '/settings/billing';
  const billingActionLabel = isGuest
    ? 'Create account'
    : usage?.plan === 'free'
      ? 'Upgrade'
      : 'Manage plan';
  const folderInMenu = folderMenuFolderId
    ? folders.find(folder => folder.id === folderMenuFolderId) ?? null
    : null;

  function formatCredits(value: number): string {
    return Number.isInteger(value) ? String(value) : value.toFixed(2);
  }

  return (
    <>
      <aside
        className="relative z-40 flex flex-col h-screen border-r border-white/10 bg-neutral-950/70 backdrop-blur-xl shrink-0 transition-[width] duration-200 ease-out"
        style={{ width: collapsed ? 64 : 224 }}
      >
        {/* Header */}
        <div className={`flex items-center h-16 px-3 border-b border-white/10 shrink-0 ${collapsed ? 'justify-center' : 'justify-between'}`}>
          {!collapsed && (
            <Link href="/documents" className="flex items-center gap-3 min-w-0">
              <Image src="/brand/logo.png" alt="BetterNotes" width={40} height={40} className="w-10 h-10 object-contain shrink-0" />
              <div className="min-w-0">
                <div className="text-[18px] leading-none font-semibold tracking-tight text-white truncate">
                  BetterNotes
                </div>
                <div className="text-[11px] text-white/58 truncate mt-0.5">AI Workspace</div>
              </div>
            </Link>
          )}
          <button
            onClick={toggle}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white/55 hover:text-white/85 hover:bg-white/10 transition-colors shrink-0"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <ChevronRightIcon /> : <ChevronLeftIcon />}
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5 scrollbar-hide">

          {/* New Notebook CTA */}
          <button
            onClick={handleCreateProject}
            title={collapsed ? 'New Notebook' : undefined}
            className={`w-full flex items-center gap-3 rounded-xl transition-all duration-150 mb-2 font-semibold
              bg-gradient-to-r from-[#b04cff] via-[#7d5cff] to-[#3d7dff] hover:from-[#c06bff] hover:via-[#8a6fff] hover:to-[#5290ff]
              text-white shadow-[0_4px_14px_rgba(96,82,255,0.45)] hover:shadow-[0_6px_18px_rgba(85,116,255,0.52)] ${
              collapsed ? 'justify-center px-2 py-2.5' : 'px-3 py-2.5'
            }`}
          >
            <PlusIcon className="w-4 h-4 shrink-0" />
            {!collapsed && <span className="text-sm truncate">New Notebook</span>}
          </button>

          {/* Home */}
          <Link
            href="/home"
            title={collapsed ? 'Home' : undefined}
            className={`flex items-center gap-3 rounded-xl transition-colors duration-150 ${
              collapsed ? 'justify-center px-2 py-2.5' : 'px-3 py-2.5'
            } ${
              isActive('/home')
                ? activeNavClass
                : 'text-white/72 hover:bg-white/10 hover:text-white'
            }`}
          >
            <HomeIcon className="w-4 h-4 shrink-0" />
            {!collapsed && <span className="text-sm truncate">Home</span>}
          </Link>

          {/* ── Resources section ── */}
          <SectionDivider label="Resources" collapsed={collapsed} />

          <div className="space-y-2">
            <Link
              href="/cheat-sheets"
              title={collapsed ? 'Cheat Sheets' : undefined}
              className={`flex items-center gap-3 rounded-xl transition-colors duration-150 ${
                collapsed ? 'justify-center px-2 py-2.5' : 'px-3 py-2.5'
              } ${
                isActive('/cheat-sheets')
                  ? aiResourceActiveNavClass
                  : aiResourceInactiveNavClass
              }`}
            >
              <CheatSheetIcon className="w-4 h-4 shrink-0" />
              {!collapsed && <span className="text-sm truncate">Cheat Sheets</span>}
            </Link>
            <Link
              href="/problem-solver"
              title={collapsed ? 'Problem Solver' : undefined}
              className={`flex items-center gap-3 rounded-xl transition-colors duration-150 ${
                collapsed ? 'justify-center px-2 py-2.5' : 'px-3 py-2.5'
              } ${
                isActive('/problem-solver')
                  ? aiResourceActiveNavClass
                  : aiResourceInactiveNavClass
              }`}
            >
              <ProblemSolverIcon className="w-4 h-4 shrink-0" />
              {!collapsed && <span className="text-sm truncate">Problem Solver</span>}
            </Link>
            <Link
              href="/exams"
              title={collapsed ? 'Exams' : undefined}
              className={`flex items-center gap-3 rounded-xl transition-colors duration-150 ${
                collapsed ? 'justify-center px-2 py-2.5' : 'px-3 py-2.5'
              } ${
                isActive('/exams')
                  ? aiResourceActiveNavClass
                  : aiResourceInactiveNavClass
              }`}
            >
              <ExamsIcon className="w-4 h-4 shrink-0" />
              {!collapsed && <span className="text-sm truncate">Exams</span>}
            </Link>
          </div>

          {/* ── Notebooks section ── */}
          <SectionDivider label="Notebooks" collapsed={collapsed} />

          {/* Search — opens full-page or ⌘K palette */}
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('open-search-palette'))}
            title={collapsed ? 'Search (⌘K)' : undefined}
            className={`flex items-center gap-3 rounded-xl transition-colors duration-150 w-full ${
              collapsed ? 'justify-center px-2 py-2.5' : 'px-3 py-2.5'
            } ${
              isActive('/search')
                ? activeNavClass
                : 'text-white/72 hover:bg-white/10 hover:text-white'
            }`}
          >
            <SearchIcon className="w-4 h-4 shrink-0" />
            {!collapsed && (
              <>
                <span className="flex-1 text-sm text-left">Search</span>
                <kbd className="shrink-0 text-[10px] text-white/30 bg-white/8 px-1.5 py-0.5 rounded font-mono">
                  ⌘K
                </kbd>
              </>
            )}
          </button>

          {/* All Notebooks */}
          {collapsed ? (
            <Link
              href="/documents"
              title="All Notebooks"
              className={`flex items-center justify-center px-2 py-2.5 rounded-xl transition-colors duration-150 ${
                isActiveDocuments()
                  ? activeNavClass
                  : 'text-white/72 hover:bg-white/10 hover:text-white'
              }`}
            >
              <DocumentsIcon className="w-4 h-4 shrink-0" />
            </Link>
          ) : (
            <div>
              <div
                className={`flex items-center gap-3 rounded-xl transition-colors duration-150 px-3 py-2.5 ${
                  isActiveDocuments()
                    ? activeNavClass
                    : 'text-white/72 hover:bg-white/10 hover:text-white'
                }`}
              >
                <button
                  onClick={() => {
                    if (activeFolderIdInSidebar) {
                      // Inside a folder: reset filter + expand, stay on /documents
                      window.dispatchEvent(new Event('folder:reset'));
                      setDocsExpanded(true);
                    } else if (pathname === '/documents') {
                      // Already on all docs, no folder: toggle
                      setDocsExpanded(e => !e);
                    } else {
                      // On different page: navigate + expand
                      setDocsExpanded(true);
                      router.push('/documents');
                    }
                  }}
                  className="flex items-center gap-3 flex-1 min-w-0 text-left"
                >
                  <DocumentsIcon className="w-4 h-4 shrink-0" />
                  <span className="text-sm truncate">All Notebooks</span>
                </button>
                <button
                  onClick={() => setDocsExpanded(e => !e)}
                  className="shrink-0 p-0.5 rounded hover:bg-white/10 transition-colors"
                  aria-label={docsExpanded ? 'Collapse folders' : 'Expand folders'}
                >
                  <svg
                    className={`w-3 h-3 transition-transform duration-150 ${docsExpanded ? 'rotate-90' : ''}`}
                    viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>

              {docsExpanded && (
                <div className="mt-0.5 space-y-0.5">
                  {visibleFolders.map(folder => {
                    const isExpanded = expandedFolderIds.has(folder.id);
                    const folderDocs = folderDocsById[folder.id] ?? [];
                    const visibleFolderDocs = folderDocs.slice(0, MAX_VISIBLE_FOLDER_DOCS);
                    const isLoadingFolderDocs = Boolean(folderDocsLoadingById[folder.id]);
                    const hasMoreFolderDocs = folderDocs.length > MAX_VISIBLE_FOLDER_DOCS;
                    const isActiveFolder = activeFolderIdInSidebar === folder.id;
                    const hasContent = folder.document_count > 0 || (folder.input_count ?? 0) > 0 || folderDocs.length > 0;
                    return (
                      <div key={folder.id} className="space-y-0.5">
                        {renamingFolderId === folder.id ? (
                          <div className="flex items-center gap-1.5 pl-7 pr-2 py-1">
                            <span
                              className="w-2 h-2 rounded-full shrink-0"
                              style={{ backgroundColor: folder.color ?? '#6366f1' }}
                            />
                            {hasContent ? (
                              <FolderListIcon className="w-3.5 h-3.5 shrink-0 text-white/55" />
                            ) : (
                              <FileIcon className="w-3.5 h-3.5 shrink-0 text-white/55" />
                            )}
                            <input
                              ref={renameInputRef}
                              value={renameName}
                              onChange={e => setRenameName(e.target.value)}
                              onBlur={() => handleRenameFolder(folder.id)}
                              onKeyDown={e => {
                                if (e.key === 'Enter') handleRenameFolder(folder.id);
                                if (e.key === 'Escape') setRenamingFolderId(null);
                              }}
                              className="flex-1 min-w-0 bg-white/10 text-white/95 text-xs rounded-md px-2 py-1 border border-white/20 focus:outline-none focus:border-indigo-500/60"
                            />
                          </div>
                        ) : (
                          <div
                            className={`flex items-center gap-1.5 w-full pl-7 pr-2 py-1.5 rounded-xl transition-colors duration-150 ${isActiveFolder ? 'bg-white/10 text-white' : 'text-white/68 hover:bg-white/5 hover:text-white/92'}`}
                          >
                            <span
                              className="w-2 h-2 rounded-full shrink-0"
                              style={{ backgroundColor: folder.color ?? '#6366f1' }}
                            />
                            {hasContent ? (
                              <FolderListIcon className="w-3.5 h-3.5 shrink-0 text-white/55" />
                            ) : (
                              <FileIcon className="w-3.5 h-3.5 shrink-0 text-white/55" />
                            )}

                            <button
                              onClick={() => navigateToFolder(folder)}
                              className="flex-1 truncate text-sm text-left"
                              title={folder.name}
                            >
                              {folder.name}
                            </button>

                            {hasContent && (
                              <button
                                onClick={() => toggleFolderExpanded(folder.id)}
                                className="shrink-0 w-5 h-5 rounded flex items-center justify-center text-white/55 hover:text-white hover:bg-white/10 transition-colors"
                                aria-label={isExpanded ? 'Collapse folder content' : 'Expand folder content'}
                                title={isExpanded ? 'Collapse folder content' : 'Expand folder content'}
                              >
                                <ChevronDownIcon className={`w-3 h-3 transition-transform duration-150 ${isExpanded ? '' : '-rotate-90'}`} />
                              </button>
                            )}

                            <button
                              data-folder-menu-button
                              onClick={e => openFolderMenu(folder.id, e.currentTarget)}
                              className="shrink-0 w-5 h-5 rounded flex items-center justify-center text-white/55 hover:text-white hover:bg-white/10 transition-colors"
                              aria-label="Open folder menu"
                              title="Folder options"
                            >
                              <DotsVerticalIcon />
                            </button>
                          </div>
                        )}

                        {(isExpanded || creatingFolderParentId === folder.id) && (
                          <div className="ml-14 mr-2 pb-1 space-y-1">
                            {isExpanded && (
                              <>
                                {isLoadingFolderDocs ? (
                                  <p className="text-[11px] text-white/50 px-1 py-0.5">Loading...</p>
                                ) : visibleFolderDocs.length > 0 ? (
                                  visibleFolderDocs.map(doc => (
                                    <Link
                                      key={doc.id}
                                      href={`/documents/${doc.id}`}
                                      className="flex items-center gap-1.5 rounded-md px-1.5 py-1 text-xs text-white/60 hover:text-white/88 hover:bg-white/6 transition-colors"
                                    >
                                      <FileIcon className="w-3 h-3 shrink-0 text-white/45" />
                                      <span className="truncate">{doc.title || 'Untitled'}</span>
                                    </Link>
                                  ))
                                ) : (
                                  <p className="text-[11px] text-white/45 px-1 py-0.5">No documents yet</p>
                                )}

                                {hasMoreFolderDocs && (
                                  <button
                                    onClick={() => navigateToFolder(folder)}
                                    className="text-[11px] text-indigo-300/85 hover:text-indigo-200 transition-colors px-1.5 py-0.5"
                                  >
                                    View all docs →
                                  </button>
                                )}
                              </>
                            )}

                            {creatingFolderParentId === folder.id && (
                              <div className="flex items-center gap-2 py-0.5">
                                <span className="w-4 h-4 flex items-center justify-center shrink-0">
                                  <FolderPlusIcon className="w-3 h-3 text-white/50" />
                                </span>
                                <input
                                  ref={newFolderInputRef}
                                  value={newFolderName}
                                  onChange={e => setNewFolderName(e.target.value)}
                                  onBlur={handleCreateFolder}
                                  onKeyDown={e => {
                                    if (e.key === 'Enter') handleCreateFolder();
                                    if (e.key === 'Escape') { setCreatingFolderParentId(null); setNewFolderName(''); }
                                  }}
                                  placeholder="Folder name"
                                  className="flex-1 min-w-0 bg-white/10 text-white/95 text-xs rounded-md px-2 py-1 border border-white/20 focus:outline-none focus:border-indigo-500/60 placeholder-white/40"
                                />
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {hasMoreFolders && (
                    <Link
                      href="/documents"
                      className="flex items-center pl-9 pr-3 py-1.5 text-xs text-indigo-400/70 hover:text-indigo-400 transition-colors"
                    >
                      View all →
                    </Link>
                  )}
                </div>
              )}
            </div>
          )}

          <Link
            href="/my-studies"
            title={collapsed ? 'My Studies' : undefined}
            className={`flex items-center gap-3 rounded-xl transition-colors duration-150 ${
              collapsed ? 'justify-center px-2 py-2.5' : 'px-3 py-2.5'
            } ${
              isActive('/my-studies')
                ? activeNavClass
                : 'text-white hover:bg-white/10 hover:text-white'
            }`}
          >
            <MyStudiesIcon className="w-4 h-4 shrink-0" />
            {!collapsed && (
              <span className="flex flex-col min-w-0 flex-1">
                <span className="text-sm truncate">My Studies</span>
                {universityName && (
                  <span className="text-[10px] text-white/40 truncate max-w-[120px]">
                    {universityName}{profileYear ? ` · Y${profileYear}` : ''}
                  </span>
                )}
              </span>
            )}
          </Link>

          {/* Templates */}
          <Link
            href="/templates"
            title={collapsed ? 'Templates' : undefined}
            className={`flex items-center gap-3 rounded-xl transition-colors duration-150 ${
              collapsed ? 'justify-center px-2 py-2.5' : 'px-3 py-2.5'
            } ${
              isActive('/templates')
                ? activeNavClass
                : 'text-white/72 hover:bg-white/10 hover:text-white'
            }`}
          >
            <TemplatesIcon className="w-4 h-4 shrink-0" />
            {!collapsed && <span className="text-sm truncate">Templates</span>}
          </Link>

          {/* ── Recents section ── */}
          {recentDocs.length > 0 && (
            <>
              {collapsed ? (
                <SectionDivider label="Recents" collapsed={collapsed} />
              ) : (
                <div className="flex items-center gap-2 px-2 pt-4 pb-1.5">
                  <div className="w-12 shrink-0" />
                  <div className="flex-1 flex items-center gap-2">
                    <div className="flex-1 h-px bg-white/10" />
                    <span className="text-[10px] font-semibold text-white/42 uppercase tracking-widest whitespace-nowrap">
                      Recents
                    </span>
                    <div className="flex-1 h-px bg-white/10" />
                  </div>
                  <button
                    onClick={() => setRecentsVisible((v) => !v)}
                    className="w-12 shrink-0 text-right text-[11px] text-white/60 hover:text-white/85 transition-colors"
                    aria-label={recentsVisible ? 'Hide recents' : 'Show recents'}
                    title={recentsVisible ? 'Hide recents' : 'Show recents'}
                  >
                    {recentsVisible ? 'Hide' : 'Show'}
                  </button>
                </div>
              )}
              {!collapsed && recentsVisible && recentDocs.map(doc => (
                <Link
                  key={doc.id}
                  href={`/documents/${doc.id}`}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-colors duration-150 truncate ${
                    pathname === `/documents/${doc.id}`
                      ? activeNavClass
                      : 'text-white/68 hover:bg-white/5 hover:text-white/90'
                  }`}
                >
                  <FileIcon className="w-3.5 h-3.5 shrink-0 text-white/45" />
                  <span className="truncate">{doc.title || 'Untitled'}</span>
                </Link>
              ))}
            </>
          )}

          {/* ── Feedback section ── */}
          <SectionDivider label="Feedback" collapsed={collapsed} />
          <button
            onClick={openFeedbackModal}
            title={collapsed ? 'Suggestions' : undefined}
            className={`flex items-center gap-3 rounded-xl transition-colors duration-150 w-full ${
              collapsed ? 'justify-center px-2 py-2.5' : 'px-3 py-2.5'
            } text-white/72 hover:bg-white/10 hover:text-white`}
          >
            <FeedbackIcon className="w-4 h-4 shrink-0" />
            {!collapsed && <span className="text-sm truncate">Suggestions</span>}
          </button>

        </nav>

        {usage && (
          <div className={`shrink-0 px-2 pb-2 ${collapsed ? 'pt-1' : 'pt-2'}`}>
            {collapsed ? (
              <Link
                href={billingHref}
                title="Credits"
                className="flex items-center justify-center px-2 py-2.5 rounded-xl text-white/72 hover:bg-indigo-500/15 hover:text-indigo-200 transition-colors"
              >
                <CreditsIcon className="w-4 h-4 shrink-0" />
              </Link>
            ) : (
              <div className="rounded-2xl border border-indigo-300/20 bg-gradient-to-b from-[#172540]/70 via-[#121d33]/70 to-[#0e1627]/70 px-3 py-3 space-y-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-2 text-sm font-semibold text-white/90">
                    <CreditsIcon className="w-4 h-4 text-indigo-300" />
                    Credits
                  </span>
                  <span className="text-sm text-white/65 tabular-nums">
                    {formatCredits(creditsRemaining)} / {creditsLimit}
                  </span>
                </div>

                <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      creditsProgress <= 10
                        ? 'bg-rose-400/90'
                        : creditsProgress <= 30
                          ? 'bg-sky-400/90'
                          : 'bg-indigo-400/90'
                    }`}
                    style={{ width: `${creditsProgress}%` }}
                  />
                </div>

                <Link
                  href={billingHref}
                  className="w-full inline-flex items-center justify-center rounded-xl border border-indigo-300/25 px-3 py-2 text-sm font-medium text-indigo-100/85 hover:bg-indigo-400/10 hover:border-indigo-200/35 hover:text-indigo-50 transition-colors"
                >
                  {billingActionLabel}
                </Link>
              </div>
            )}
          </div>
        )}

        {/* Profile footer */}
        <div ref={profileRef} className="relative border-t border-white/10 p-2 shrink-0 bg-black/20">
          <button
            onClick={() => setProfileOpen(o => !o)}
            className={`flex items-center gap-2.5 w-full rounded-xl hover:bg-white/10 transition-colors duration-150 ${
              collapsed ? 'justify-center p-2' : 'px-3 py-2.5'
            }`}
          >
            <div
              className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500/40 to-fuchsia-500/40 border border-white/15 flex items-center justify-center shrink-0 bg-cover bg-center"
              style={avatarUrl ? { backgroundImage: `url(${avatarUrl})` } : undefined}
            >
              {!avatarUrl && <span className="text-xs font-medium text-white/80">{initial}</span>}
            </div>
            {!collapsed && (
              <div className="flex-1 text-left min-w-0">
                <div className="text-xs text-white/80 truncate">{profileLabel}</div>
                <div className="text-[10px] text-white/40 truncate">{visibleEmail}</div>
              </div>
            )}
          </button>

          {profileOpen && (
            <div className={`absolute ${collapsed ? 'left-full ml-2' : 'left-2 right-2'} bottom-full mb-2 rounded-xl border border-white/20 bg-black/60 backdrop-blur-xl shadow-[0_-10px_40px_rgba(0,0,0,0.4)] py-1 z-50 animate-scale min-w-[160px]`}>
              <Link
                href="/profile"
                onClick={() => setProfileOpen(false)}
                className="flex items-center gap-2 px-3 py-2 text-sm text-white/80 hover:bg-white/10 transition-colors"
              >
                <UserIcon className="w-4 h-4" />
                Edit profile
              </Link>
              {userId && (
                <Link
                  href={`/profile/${userId}`}
                  onClick={() => setProfileOpen(false)}
                  className="flex items-center gap-2 px-3 py-2 text-sm text-white/80 hover:bg-white/10 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  View public profile
                </Link>
              )}
              <Link
                href="/settings"
                onClick={() => setProfileOpen(false)}
                className="flex items-center gap-2 px-3 py-2 text-sm text-white/80 hover:bg-white/10 transition-colors"
              >
                <SettingsIcon className="w-4 h-4" />
                Settings
              </Link>
              <Link
                href={billingHref}
                onClick={() => setProfileOpen(false)}
                className="flex items-center gap-2 px-3 py-2 text-sm text-white/80 hover:bg-white/10 transition-colors"
              >
                <BillingIcon className="w-4 h-4" />
                Billing / Plan
              </Link>
              <Link
                href="/support"
                onClick={() => setProfileOpen(false)}
                className="flex items-center gap-2 px-3 py-2 text-sm text-white/80 hover:bg-white/10 transition-colors"
              >
                <SupportIcon className="w-4 h-4" />
                Support
              </Link>
              <div className="h-px bg-white/10 my-1" />
              <button
                onClick={handleSignOut}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-300/80 hover:bg-red-500/10 hover:text-red-300 transition-colors"
              >
                <SignOutIcon className="w-4 h-4" />
                Sign out
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Folder actions menu */}
      {folderInMenu && folderMenuPos && createPortal(
        <div
          data-folder-menu
          style={{ top: folderMenuPos.top, left: folderMenuPos.left }}
          className="fixed z-[10000] w-44 rounded-xl border border-white/20 bg-neutral-900/96 backdrop-blur-xl p-1 shadow-2xl"
        >
          <button
            onClick={() => {
              setRenamingFolderId(folderInMenu.id);
              setRenameName(folderInMenu.name);
              closeFolderMenu();
            }}
            className="w-full flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-white/80 hover:bg-white/10 hover:text-white transition-colors"
          >
            <PencilIcon />
            Edit
          </button>
          <button
            onClick={(e) => {
              closeFolderMenu();
              openColorPicker(folderInMenu.id, e.currentTarget);
            }}
            className="w-full flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-white/80 hover:bg-white/10 hover:text-white transition-colors"
          >
            <PaletteIcon className="w-3.5 h-3.5" />
            Color
          </button>
          <button
            onClick={() => void toggleFolderPin(folderInMenu)}
            className="w-full flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-white/80 hover:bg-white/10 hover:text-white transition-colors"
          >
            <PinIcon className="w-3.5 h-3.5" />
            {folderInMenu.is_starred ? 'Unpin' : 'Pin to top'}
          </button>
          <button
            onClick={() => startCreateFolderInside(folderInMenu.id)}
            className="w-full flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-white/80 hover:bg-white/10 hover:text-white transition-colors"
          >
            <FolderPlusIcon className="w-3.5 h-3.5" />
            Create subfolder
          </button>
          <button
            onClick={() => handleCreateDocumentInFolder(folderInMenu.id)}
            className="w-full flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-white/80 hover:bg-white/10 hover:text-white transition-colors"
          >
            <DocumentPlusIcon className="w-3.5 h-3.5" />
            Create document
          </button>
          <button
            onClick={() => {
              closeFolderMenu();
              if (!window.confirm(`Delete folder "${folderInMenu.name}"?`)) return;
              void handleDeleteFolder(folderInMenu.id);
            }}
            className="w-full flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-red-300/85 hover:bg-red-500/15 hover:text-red-200 transition-colors"
          >
            <TrashIcon />
            Delete
          </button>
        </div>,
        document.body
      )}

      {/* Color picker portal */}
      {colorPickerFolderId && colorPickerPos && createPortal(
        <div
          data-color-picker
          style={{ top: colorPickerPos.top, left: colorPickerPos.left }}
          className="fixed z-[9999] bg-neutral-900/95 backdrop-blur-xl border border-white/20 rounded-xl p-2 shadow-2xl"
        >
          <div className="grid grid-cols-5 gap-1.5">
            {PRESET_COLORS.map(color => (
              <button
                key={color}
                onClick={() => handleColorChange(colorPickerFolderId, color)}
                className="w-5 h-5 rounded-full transition-transform hover:scale-110 ring-offset-neutral-900 hover:ring-2 hover:ring-white/40 hover:ring-offset-1"
                style={{ backgroundColor: color }}
                title={color}
              />
            ))}
          </div>
        </div>,
        document.body
      )}

      {/* Feedback modal */}
      {isFeedbackOpen && createPortal(
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Close feedback modal"
            onClick={closeFeedbackModal}
            className="absolute inset-0 bg-black/65 backdrop-blur-sm"
          />

          <div className="relative z-10 w-full max-w-md rounded-2xl border border-white/20 bg-neutral-900/95 shadow-2xl p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3 mb-3">
              <h3 className="text-sm font-semibold text-white">Send Suggestions</h3>
              <button
                type="button"
                onClick={closeFeedbackModal}
                disabled={isSubmittingFeedback}
                className="w-7 h-7 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-50"
                aria-label="Close"
              >
                <svg className="w-4 h-4 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <p className="text-xs text-white/50 mb-3">
              Tell us what we should improve.
            </p>

            <form onSubmit={handleSubmitFeedback} className="space-y-3">
              <textarea
                ref={feedbackTextareaRef}
                value={feedbackMessage}
                onChange={(e) => setFeedbackMessage(e.target.value)}
                placeholder="Example: It would be great if..."
                rows={5}
                maxLength={2000}
                disabled={isSubmittingFeedback}
                className="w-full resize-none appearance-none rounded-xl bg-[#1f1f1f] border border-white/15 px-3 py-2 text-sm text-white placeholder-white/30 outline-none focus:border-indigo-400/60 transition-colors disabled:opacity-60"
              />

              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] text-white/35">{feedbackMessage.length}/2000</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={closeFeedbackModal}
                    disabled={isSubmittingFeedback}
                    className="px-3 py-1.5 rounded-lg border border-white/15 text-white/60 hover:text-white hover:border-white/30 transition-colors text-xs disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingFeedback || feedbackMessage.trim().length < 5}
                    className="px-3 py-1.5 rounded-lg bg-indigo-500 hover:bg-indigo-400 text-white text-xs font-medium transition-colors disabled:opacity-50"
                  >
                    {isSubmittingFeedback ? 'Sending...' : 'Send'}
                  </button>
                </div>
              </div>

              {feedbackError && (
                <p className="text-xs text-red-400">{feedbackError}</p>
              )}
              {feedbackSuccess && (
                <p className="text-xs text-emerald-400">{feedbackSuccess}</p>
              )}
            </form>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

/* ---- Icon components ---- */
function PlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
    </svg>
  );
}
function HomeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
    </svg>
  );
}
function DocumentsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
    </svg>
  );
}
function TemplatesIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
    </svg>
  );
}
function SettingsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}
function UserIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M20 21a8 8 0 10-16 0M12 11a4 4 0 100-8 4 4 0 000 8z" />
    </svg>
  );
}
function BillingIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 8.5h16M6.5 4h11A2.5 2.5 0 0120 6.5v11a2.5 2.5 0 01-2.5 2.5h-11A2.5 2.5 0 014 17.5v-11A2.5 2.5 0 016.5 4z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 14h3" />
    </svg>
  );
}
function CreditsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 2L4.5 13h5l-1 9L19.5 11h-5L13 2z" />
    </svg>
  );
}
function SupportIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
    </svg>
  );
}
function FileIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    </svg>
  );
}
function ChevronLeftIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
    </svg>
  );
}
function ChevronRightIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  );
}
function SignOutIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
    </svg>
  );
}
function PencilIcon({ className }: { className?: string }) {
  return (
    <svg className={className ?? 'w-3 h-3'} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" />
    </svg>
  );
}
function TrashIcon({ className }: { className?: string }) {
  return (
    <svg className={className ?? 'w-3 h-3'} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
    </svg>
  );
}
function DotsVerticalIcon() {
  return (
    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="5" r="2" />
      <circle cx="12" cy="12" r="2" />
      <circle cx="12" cy="19" r="2" />
    </svg>
  );
}
function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
    </svg>
  );
}
function PaletteIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3a9 9 0 100 18h1.1a2.9 2.9 0 002.9-2.9 2.1 2.1 0 012.1-2.1h.4A2.5 2.5 0 0021 13.5 10.5 10.5 0 0012 3z" />
      <circle cx="7.5" cy="10" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="10.5" cy="7.5" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="14.25" cy="7.25" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  );
}
function PinIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 3l6 6-3 1.5v3L13.5 18l-1.5-1.5L7.5 21 6 19.5l4.5-4.5L9 13.5v-3L3 9l6-6h6z" />
    </svg>
  );
}
function FolderPlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 7.5A2.5 2.5 0 015.5 5H10l2 2h6.5A2.5 2.5 0 0121 9.5v7A2.5 2.5 0 0118.5 19h-13A2.5 2.5 0 013 16.5v-9z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 10.5v5m2.5-2.5h-5" />
    </svg>
  );
}
function FolderListIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.5 7.5A2.5 2.5 0 016 5h4l1.9 2H18a2.5 2.5 0 012.5 2.5v6.9A2.6 2.6 0 0117.9 19H6.1A2.6 2.6 0 013.5 16.4V7.5z" />
    </svg>
  );
}
function DocumentPlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8l-5-5z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M14 3v5h5" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 12v5m2.5-2.5h-5" />
    </svg>
  );
}
// ── Placeholder feature icons ────────────────────────────────────────────────
function CheatSheetIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 9h16.5m-16.5 6.75h16.5M3.75 5.25h16.5a.75.75 0 01.75.75v12a.75.75 0 01-.75.75H3.75a.75.75 0 01-.75-.75V6a.75.75 0 01.75-.75z" />
    </svg>
  );
}
function ProblemSolverIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
    </svg>
  );
}
function ExamsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}
function SearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 15.803 7.5 7.5 0 0015.803 15.803z" />
    </svg>
  );
}
function MyStudiesIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5" />
    </svg>
  );
}
function FeedbackIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3h6m-9.75 8.25h11.379a3.375 3.375 0 002.385-.988l2.487-2.487a3.375 3.375 0 00.988-2.386V6.375A3.375 3.375 0 0018.614 3H5.386A3.375 3.375 0 002.01 6.375v9.75A3.375 3.375 0 005.386 19.5H3.75z" />
    </svg>
  );
}
