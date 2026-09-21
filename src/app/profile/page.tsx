import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { ProfilePanel } from "@/features/profile/profile-panel";

export const metadata: Metadata = {
  title: "我的科研画像",
  description: "看看你现在的科研阶段、已经具备的基础、接下来可以补的经验，以及三条优先行动。",
};

export default function ProfilePage() {
  return (
    <>
      <SiteHeader />
      <main id="main-content" className="container page">
        <ProfilePanel />
      </main>
      <footer className="container site-footer">科研小助理 · 深圳大学学生团队</footer>
    </>
  );
}
