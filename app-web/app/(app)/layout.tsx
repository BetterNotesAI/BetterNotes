import AppBackground from "../components/AppBackground";
import Sidebar from "../components/Sidebar";
import SearchModal from "../components/SearchModal";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-screen text-white relative flex flex-col overflow-hidden">
      <AppBackground />
      <SearchModal />

      <div className="flex flex-1 min-h-0">
        {/* Phase 2 Sidebar — replaces the old minimal sidebar */}
        <Sidebar />

        {/* Main content area */}
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  );
}
