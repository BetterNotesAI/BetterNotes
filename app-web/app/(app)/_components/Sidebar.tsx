'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

interface RecentDoc { id: string; title: string }

interface SidebarFolder {
  id: string;
  name: string;
  color: string | null;
  document_count: number;
  created_at: string;
}

const COLLAPSED_KEY = 'bn_sidebar_collapsed';
// Routes where sidebar auto-collapses (editor needs space)
const EDITOR_PREFIX = '/documents/';
// Max folders shown in the sub-menu before "View all →"
const MAX_FOLDERS_VISIBLE = 5;

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(true); // default collapsed during SSR
  const [userToggled, setUserToggled] = useState(false);
  const [email, setEmail] = useState('');
  const [recentDocs, setRecentDocs] = useState<RecentDoc[]>([]);
  const [folders, setFolders] = useState<SidebarFolder[]>([]);
  const [docsExpanded, setDocsExpanded] = useState(true);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  // Hydrate from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(COLLAPSED_KEY);
    if (stored !== null) setCollapsed(stored === 'true');
  }, []);

  // Persist collapsed state
  useEffect(() => {
    localStorage.setItem(COLLAPSED_KEY, String(collapsed));
  }, [collapsed]);

  // Auto-collapse on editor routes (unless user manually expanded)
  useEffect(() => {
    if (pathname.startsWith(EDITOR_PREFIX)) {
      if (!userToggled) setCollapsed(true);
    } else {
      setUserToggled(false);
    }
  }, [pathname, userToggled]);

  // Load user email
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (data.user?.email) setEmail(data.user.email);
    });
  }, []);

  // Load recent documents — API returns { documents: [...] }, no limit param, slice client-side
  useEffect(() => {
    fetch('/api/documents')
      .then(r => r.ok ? r.json() : { documents: [] })
      .then(data => {
        const docs: RecentDoc[] = (data.documents ?? []).slice(0, 5);
        setRecentDocs(docs);
      })
      .catch(() => {});
  }, []);

  // Load folders (and re-load when FolderPanel dispatches 'folders:updated')
  function loadFolders() {
    fetch('/api/folders')
      .then(r => r.ok ? r.json() : { folders: [] })
      .then(data => {
        const sorted: SidebarFolder[] = (data.folders ?? [])
          .sort((a: SidebarFolder, b: SidebarFolder) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          );
        setFolders(sorted);
      })
      .catch(() => {});
  }

  useEffect(() => {
    loadFolders();
    window.addEventListener('folders:updated', loadFolders);
    return () => window.removeEventListener('folders:updated', loadFolders);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Close profile menu on outside click
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

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/');
  }

  function toggle() {
    setUserToggled(true);
    setCollapsed(c => !c);
  }

  // isActive for /documents: true on /documents AND any /documents/* sub-route
  function isActiveDocuments() {
    return pathname === '/documents' || pathname.startsWith('/documents/');
  }

  function isActive(href: string) {
    if (href === '/home') return pathname === '/home';
    return pathname.startsWith(href);
  }

  const initial = email ? email[0].toUpperCase() : 'U';

  const visibleFolders = folders.slice(0, MAX_FOLDERS_VISIBLE);
  const hasMoreFolders = folders.length > MAX_FOLDERS_VISIBLE;

  return (
    <aside
      className="relative z-40 flex flex-col h-screen border-r border-white/10 bg-neutral-950/70 backdrop-blur-xl shrink-0 transition-[width] duration-200 ease-out"
      style={{ width: collapsed ? 64 : 224 }}
    >
      {/* Header: logo + toggle */}
      <div className={`flex items-center h-14 px-3 border-b border-white/10 shrink-0 ${collapsed ? 'justify-center' : 'justify-between'}`}>
        {!collapsed && (
          <Link href="/documents" className="flex items-center gap-2 min-w-0">
            <Image src="/brand/logo.png" alt="BetterNotes" width={28} height={28} className="w-7 h-7 object-contain shrink-0" />
            <span className="text-sm font-semibold tracking-tight text-white truncate">BetterNotes</span>
          </Link>
        )}
        <button
          onClick={toggle}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-white/40 hover:text-white/80 hover:bg-white/8 transition-colors shrink-0"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRightIcon /> : <ChevronLeftIcon />}
        </button>
      </div>

      {/* Nav items */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5 scrollbar-hide">

        {/* A) New Document CTA */}
        <Link
          href="/documents?new=1"
          title={collapsed ? 'New Document' : undefined}
          className={`flex items-center gap-3 rounded-xl transition-colors duration-150 mb-2 bg-white text-neutral-950 hover:bg-white/90 font-semibold ${
            collapsed ? 'justify-center px-2 py-2.5' : 'px-3 py-2.5'
          }`}
        >
          <PlusIcon className="w-4 h-4 shrink-0" />
          {!collapsed && <span className="text-sm truncate">New Document</span>}
        </Link>

        {/* B) Home */}
        <Link
          href="/home"
          title={collapsed ? 'Home' : undefined}
          className={`flex items-center gap-3 rounded-xl transition-colors duration-150 ${
            collapsed ? 'justify-center px-2 py-2.5' : 'px-3 py-2.5'
          } ${
            isActive('/home')
              ? `bg-white/15 text-white font-medium${collapsed ? '' : ' border-r-2 border-indigo-400'}`
              : 'text-white/60 hover:bg-white/10 hover:text-white'
          }`}
        >
          <HomeIcon className="w-4 h-4 shrink-0" />
          {!collapsed && <span className="text-sm truncate">Home</span>}
        </Link>

        {/* C) All Documents — with collapsible folder sub-menu when expanded */}
        {collapsed ? (
          <Link
            href="/documents"
            title="All Documents"
            className={`flex items-center justify-center px-2 py-2.5 rounded-xl transition-colors duration-150 ${
              isActiveDocuments()
                ? 'bg-white/15 text-white font-medium'
                : 'text-white/60 hover:bg-white/10 hover:text-white'
            }`}
          >
            <DocumentsIcon className="w-4 h-4 shrink-0" />
          </Link>
        ) : (
          <div>
            {/* All Documents row with toggle arrow */}
            <div
              className={`flex items-center gap-3 rounded-xl transition-colors duration-150 px-3 py-2.5 ${
                isActiveDocuments()
                  ? 'bg-white/15 text-white font-medium border-r-2 border-indigo-400'
                  : 'text-white/60 hover:bg-white/10 hover:text-white'
              }`}
            >
              <Link
                href="/documents"
                className="flex items-center gap-3 flex-1 min-w-0"
              >
                <DocumentsIcon className="w-4 h-4 shrink-0" />
                <span className="text-sm truncate">All Documents</span>
              </Link>
              <button
                onClick={() => setDocsExpanded(e => !e)}
                className="shrink-0 p-0.5 rounded hover:bg-white/10 transition-colors"
                aria-label={docsExpanded ? 'Collapse folders' : 'Expand folders'}
              >
                <svg
                  className={`w-3 h-3 transition-transform duration-150 ${docsExpanded ? 'rotate-90' : ''}`}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2.5}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>

            {/* Folder sub-menu */}
            {docsExpanded && (
              <div className="mt-0.5 space-y-0.5">
                {folders.length === 0 ? (
                  <p className="pl-9 pr-3 py-1.5 text-xs text-white/30">No folders yet</p>
                ) : (
                  <>
                    {visibleFolders.map(folder => (
                      <button
                        key={folder.id}
                        onClick={() => {
                          localStorage.setItem('bn_active_folder', folder.id);
                          window.dispatchEvent(new CustomEvent('folder:activate', { detail: { folderId: folder.id } }));
                          router.push('/documents');
                        }}
                        className="flex items-center gap-2 w-full pl-9 pr-3 py-1.5 rounded-xl text-sm transition-colors duration-150 text-white/50 hover:bg-white/5 hover:text-white/80"
                      >
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: folder.color ?? '#6366f1' }}
                        />
                        <span className="flex-1 truncate text-sm text-left">{folder.name}</span>
                        {folder.document_count > 0 && (
                          <span className="shrink-0 text-white/30 text-[10px]">{folder.document_count}</span>
                        )}
                      </button>
                    ))}
                    {hasMoreFolders && (
                      <Link
                        href="/documents"
                        className="flex items-center pl-9 pr-3 py-1.5 text-xs text-indigo-400/70 hover:text-indigo-400 transition-colors"
                      >
                        View all →
                      </Link>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* D) Templates */}
        <Link
          href="/templates"
          title={collapsed ? 'Templates' : undefined}
          className={`flex items-center gap-3 rounded-xl transition-colors duration-150 ${
            collapsed ? 'justify-center px-2 py-2.5' : 'px-3 py-2.5'
          } ${
            isActive('/templates')
              ? `bg-white/15 text-white font-medium${collapsed ? '' : ' border-r-2 border-indigo-400'}`
              : 'text-white/60 hover:bg-white/10 hover:text-white'
          }`}
        >
          <TemplatesIcon className="w-4 h-4 shrink-0" />
          {!collapsed && <span className="text-sm truncate">Templates</span>}
        </Link>

        {/* E) Recent documents — expanded only */}
        {!collapsed && recentDocs.length > 0 && (
          <div className="mt-4">
            <p className="px-3 py-1.5 text-[11px] font-semibold text-white/40 uppercase tracking-wider">
              Recent
            </p>
            {recentDocs.map(doc => (
              <Link
                key={doc.id}
                href={`/documents/${doc.id}`}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-colors duration-150 truncate ${
                  pathname === `/documents/${doc.id}`
                    ? 'bg-white/15 text-white border-r-2 border-indigo-400'
                    : 'text-white/50 hover:bg-white/5 hover:text-white/80'
                }`}
              >
                <FileIcon className="w-3.5 h-3.5 shrink-0 text-white/30" />
                <span className="truncate">{doc.title || 'Untitled'}</span>
              </Link>
            ))}
          </div>
        )}
      </nav>

      {/* Profile footer */}
      <div ref={profileRef} className="relative border-t border-white/10 p-2 shrink-0 bg-black/20">
        <button
          onClick={() => setProfileOpen(o => !o)}
          className={`flex items-center gap-2.5 w-full rounded-xl hover:bg-white/10 transition-colors duration-150 ${
            collapsed ? 'justify-center p-2' : 'px-3 py-2.5'
          }`}
        >
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500/40 to-fuchsia-500/40 border border-white/15 flex items-center justify-center shrink-0">
            <span className="text-xs font-medium text-white/80">{initial}</span>
          </div>
          {!collapsed && (
            <div className="flex-1 text-left min-w-0">
              <div className="text-xs text-white/80 truncate">{email.split('@')[0]}</div>
              <div className="text-[10px] text-white/40 truncate">{email}</div>
            </div>
          )}
        </button>

        {profileOpen && (
          <div className={`absolute ${collapsed ? 'left-full ml-2' : 'left-2 right-2'} bottom-full mb-2 rounded-xl border border-white/20 bg-black/60 backdrop-blur-xl shadow-[0_-10px_40px_rgba(0,0,0,0.4)] py-1 z-50 animate-scale min-w-[160px]`}>
            <Link
              href="/settings/billing"
              onClick={() => setProfileOpen(false)}
              className="flex items-center gap-2 px-3 py-2 text-sm text-white/80 hover:bg-white/10 transition-colors"
            >
              <SettingsIcon className="w-4 h-4" />
              Settings
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
