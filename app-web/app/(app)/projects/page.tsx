"use client";

import { Suspense, useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { listProjects, createProject, listFolders, createFolder, type Project, type Folder } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import ProjectCard from "@/app/components/ProjectCard";
import FolderCard from "@/app/components/FolderCard";
import { templates } from "@/lib/templates";
import type { User } from "@supabase/supabase-js";

type Filter = "all" | "starred";

export default function ProjectsPage() {
    return (
        <Suspense fallback={<div className="flex items-center justify-center h-full min-h-[60vh]"><div className="text-white/40 text-sm">Loading projects…</div></div>}>
            <ProjectsContent />
        </Suspense>
    );
}

function ProjectsContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [user, setUser] = useState<User | null>(null);
    const [projects, setProjects] = useState<Project[]>([]);
    const [folders, setFolders] = useState<Folder[]>([]);
    const [activeFolderId, setActiveFolderId] = useState<string | null>(null); // null = root view
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<Filter>("all");
    const [search, setSearch] = useState("");
    const [showNewModal, setShowNewModal] = useState(false);
    const [newTitle, setNewTitle] = useState("");
    const [newTemplateId, setNewTemplateId] = useState<string | null>(null);
    const [creating, setCreating] = useState(false);
    const [showNewFolderModal, setShowNewFolderModal] = useState(false);
    const [newFolderName, setNewFolderName] = useState("");
    const [creatingFolder, setCreatingFolder] = useState(false);

    // Auth first, then projects — with a hard 8s timeout so the page never hangs forever
    const [authLoading, setAuthLoading] = useState(true);
    useEffect(() => {
        let mounted = true;

        const timeoutId = setTimeout(() => {
            if (mounted) { setAuthLoading(false); setLoading(false); }
        }, 8000);

        async function init() {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                if (!mounted) return;
                setUser(session?.user ?? null);
                setAuthLoading(false);

                const [initialProjects, initialFolders] = await Promise.all([
                    listProjects({ search: search.trim() || undefined }),
                    listFolders(),
                ]);
                if (!mounted) return;
                setProjects(initialProjects);
                setFolders(initialFolders);
                setLoading(false);
            } catch {
                if (mounted) { setAuthLoading(false); setLoading(false); }
            } finally {
                clearTimeout(timeoutId);
            }
        }

        init();

        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            (_event, session) => { if (mounted) setUser(session?.user ?? null); }
        );
        return () => { mounted = false; clearTimeout(timeoutId); subscription.unsubscribe(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Auto-open new modal from URL
    useEffect(() => {
        if (searchParams.get("new") === "true") {
            setShowNewModal(true);
        }
    }, [searchParams]);

    const fetchProjects = useCallback(async () => {
        if (!user) return;
        setLoading(true);
        const [data, folderData] = await Promise.all([
            listProjects({
                starred: filter === "starred" ? true : undefined,
                search: search.trim() || undefined,
                // In folder view, filter server-side. At root, fetch all so we can count per folder.
                folderId: activeFolderId ?? undefined,
            }),
            listFolders(),
        ]);
        setProjects(data);
        setFolders(folderData);
        setLoading(false);
    }, [user, filter, search, activeFolderId]);

    // Re-fetch when filter, search, or active folder changes (initial load handled above)
    useEffect(() => {
        if (authLoading) return;
        fetchProjects();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filter, search, activeFolderId]);

    async function handleCreateFolder() {
        if (creatingFolder) return;
        const name = newFolderName.trim();
        if (!name) return;
        setCreatingFolder(true);
        await createFolder(name);
        setCreatingFolder(false);
        setShowNewFolderModal(false);
        setNewFolderName("");
        fetchProjects();
    }

    async function handleCreateProject() {
        if (creating) return;
        setCreating(true);
        const { project } = await createProject({
            title: newTitle.trim() || "Untitled Project",
            template_id: newTemplateId || undefined,
        });
        setCreating(false);
        if (project) {
            setShowNewModal(false);
            setNewTitle("");
            setNewTemplateId(null);
            router.push(`/workspace/${project.id}`);
        }
    }

    if (authLoading) {
        return (
            <div className="flex items-center justify-center h-full min-h-[60vh]">
                <div className="w-6 h-6 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
            </div>
        );
    }

    if (!user) {
        return (
            <div className="flex flex-col items-center justify-center h-full min-h-[60vh] gap-4">
                <div className="text-white/40 text-sm">Sign in to view your projects</div>
                <a href="/login" className="rounded-xl px-4 py-2 text-sm bg-white text-neutral-950 hover:bg-white/90 font-medium">Log in</a>
            </div>
        );
    }

    const filterButtons: { key: Filter; label: string }[] = [
        { key: "all", label: "All" },
        { key: "starred", label: "Starred" },
    ];

    const activeFolder = folders.find(f => f.id === activeFolderId) ?? null;
    // At root: only show projects not assigned to any folder
    const displayedProjects = activeFolder ? projects : projects.filter(p => p.folder_id === null);

    return (
        <div className="max-w-6xl mx-auto px-6 py-8">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    {activeFolder ? (
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setActiveFolderId(null)}
                                className="text-sm text-white/40 hover:text-white/70 transition-colors flex items-center gap-1"
                            >
                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                                </svg>
                                Projects
                            </button>
                            <span className="text-white/20">/</span>
                            <h1 className="text-xl font-bold text-white">{activeFolder.name}</h1>
                        </div>
                    ) : (
                        <h1 className="text-2xl font-bold text-white">Projects</h1>
                    )}
                    <p className="text-sm text-white/40 mt-1">
                        {projects.length} project{projects.length !== 1 ? "s" : ""}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    {!activeFolder && (
                        <button
                            onClick={() => setShowNewFolderModal(true)}
                            className="flex items-center gap-2 rounded-xl border border-white/15 bg-white/8 hover:bg-white/12 px-3 py-2.5 text-sm text-white/70 hover:text-white transition-all"
                        >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                            </svg>
                            New Folder
                        </button>
                    )}
                    <button
                        onClick={() => setShowNewModal(true)}
                        className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-purple-600/80 to-blue-600/80 hover:from-purple-500 hover:to-blue-500 border border-white/10 px-4 py-2.5 text-sm font-medium text-white transition-all"
                    >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                        </svg>
                        New Project
                    </button>
                </div>
            </div>

            {/* Search + Filters */}
            <div className="flex items-center gap-3 mb-6">
                <div className="relative flex-1 max-w-md">
                    <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                    </svg>
                    <input
                        type="text"
                        placeholder="Search projects..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full rounded-xl border border-white/10 bg-white/5 pl-10 pr-4 py-2.5 text-sm text-white placeholder-white/30 outline-none focus:border-white/20 focus:bg-white/8 transition-colors"
                    />
                </div>

                <div className="flex items-center rounded-xl border border-white/10 bg-white/5 p-0.5">
                    {filterButtons.map(({ key, label }) => (
                        <button
                            key={key}
                            onClick={() => setFilter(key)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filter === key
                                ? "bg-white/15 text-white"
                                : "text-white/50 hover:text-white/70"
                                }`}
                        >
                            {label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Content */}
            {loading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {Array.from({ length: 8 }).map((_, i) => (
                        <div key={i} className="rounded-2xl border border-white/8 bg-white/[0.03] h-52 animate-pulse" />
                    ))}
                </div>
            ) : (
                <>
                    {/* Folder row — only visible at root view */}
                    {!activeFolder && folders.length > 0 && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-6">
                            {folders.map((f) => (
                                <FolderCard
                                    key={f.id}
                                    folder={f}
                                    projectCount={projects.filter(p => p.folder_id === f.id).length}
                                    onClick={() => setActiveFolderId(f.id)}
                                    onUpdate={fetchProjects}
                                />
                            ))}
                        </div>
                    )}

                    {/* Projects grid */}
                    {/* Show empty state only when: searching with no results, inside an empty folder, or truly no projects at all */}
                    {displayedProjects.length === 0 && (search || activeFolder || projects.length === 0) ? (
                        <div className="flex flex-col items-center justify-center py-20 text-center">
                            <svg className="h-16 w-16 text-white/10 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="0.75">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
                            </svg>
                            <p className="text-white/40 text-sm mb-4">
                                {search
                                    ? "No projects match your search"
                                    : activeFolder
                                        ? "No projects in this folder"
                                        : "No projects yet"}
                            </p>
                            {!search && (
                                <button
                                    onClick={() => setShowNewModal(true)}
                                    className="rounded-xl bg-white/10 border border-white/15 px-4 py-2 text-sm text-white/80 hover:bg-white/15 transition-colors"
                                >
                                    {activeFolder ? "Add a project" : "Create your first project"}
                                </button>
                            )}
                        </div>
                    ) : displayedProjects.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                            {displayedProjects.map((p) => (
                                <ProjectCard key={p.id} project={p} folders={folders} onUpdate={fetchProjects} />
                            ))}
                        </div>
                    ) : null}
                </>
            )}

            {/* New Project Modal */}
            {showNewModal && (
                <div className="fixed inset-0 z-[99] flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="rounded-2xl border border-white/15 bg-neutral-900 p-6 shadow-2xl max-w-md w-full mx-4">
                        <h2 className="text-lg font-semibold text-white mb-4">New Project</h2>

                        <label className="block text-xs text-white/50 mb-1">Project name</label>
                        <input
                            autoFocus
                            value={newTitle}
                            onChange={(e) => setNewTitle(e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter") handleCreateProject(); }}
                            placeholder="e.g. Thermodynamics Notes"
                            className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-sm text-white placeholder-white/30 outline-none focus:border-white/25 mb-4"
                        />

                        <label className="block text-xs text-white/50 mb-2">Template (optional)</label>
                        <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto mb-4">
                            {templates.map((t) => (
                                <button
                                    key={t.id}
                                    onClick={() => setNewTemplateId(newTemplateId === t.id ? null : t.id)}
                                    className={`rounded-xl border px-3 py-2 text-xs text-left transition-colors ${newTemplateId === t.id
                                        ? "border-purple-500/50 bg-purple-500/10 text-white"
                                        : "border-white/10 bg-white/5 text-white/60 hover:bg-white/8"
                                        }`}
                                >
                                    {t.name}
                                    {t.isPro && <span className="ml-1 text-[10px] text-purple-300">PRO</span>}
                                </button>
                            ))}
                        </div>

                        <div className="flex items-center justify-end gap-2">
                            <button
                                onClick={() => { setShowNewModal(false); setNewTitle(""); setNewTemplateId(null); }}
                                className="rounded-xl border border-white/15 bg-white/10 px-4 py-2 text-sm text-white hover:bg-white/15"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleCreateProject}
                                disabled={creating}
                                className="rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 px-4 py-2 text-sm font-semibold text-white hover:from-purple-500 hover:to-blue-500 disabled:opacity-50"
                            >
                                {creating ? "Creating..." : "Create"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* New Folder Modal */}
            {showNewFolderModal && (
                <div className="fixed inset-0 z-[99] flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="rounded-2xl border border-white/15 bg-neutral-900 p-6 shadow-2xl max-w-sm w-full mx-4">
                        <h2 className="text-lg font-semibold text-white mb-4">New Folder</h2>
                        <label className="block text-xs text-white/50 mb-1">Folder name</label>
                        <input
                            autoFocus
                            value={newFolderName}
                            onChange={(e) => setNewFolderName(e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter") handleCreateFolder(); if (e.key === "Escape") { setShowNewFolderModal(false); setNewFolderName(""); } }}
                            placeholder="e.g. Semester 1"
                            className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-sm text-white placeholder-white/30 outline-none focus:border-white/25 mb-5"
                        />
                        <div className="flex items-center justify-end gap-2">
                            <button
                                onClick={() => { setShowNewFolderModal(false); setNewFolderName(""); }}
                                className="rounded-xl border border-white/15 bg-white/10 px-4 py-2 text-sm text-white hover:bg-white/15"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleCreateFolder}
                                disabled={creatingFolder || !newFolderName.trim()}
                                className="rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 px-4 py-2 text-sm font-semibold text-white hover:from-purple-500 hover:to-blue-500 disabled:opacity-50"
                            >
                                {creatingFolder ? "Creating…" : "Create"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
