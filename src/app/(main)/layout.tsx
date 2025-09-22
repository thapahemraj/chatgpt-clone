
import Header from "@/components/header/Header";
import Sidepanel from "@/components/sidepanel/Sidepanel";

export default function MainLayout({ children }: { children: React.ReactNode }) {

  return (
    <div className="min-h-screen flex">
      <div>
        <Sidepanel />
      </div>
      <div className="flex-1 flex flex-col h-[100vh]">
        <div>
          <Header />
        </div>
          {children}
      </div>
    </div>
  );
}
