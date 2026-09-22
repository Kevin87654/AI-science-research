import Link from "next/link";
import { SiteHeader } from "@/components/site-header";

const steps = [
  { title: "认识自己", description: "从兴趣、基础和可投入的时间出发，了解自己的科研起点。" },
  { title: "找到下一步", description: "把想尝试的方向拆成有顺序、有完成标准的小任务。" },
  { title: "开始第一次实践", description: "借助有来源的科研资料和校内资源，逐步积累真实经历。" },
];

export default function HomePage() {
  return (
    <>
      <SiteHeader />
      <main id="main-content" className="container">
        <section className="hero" aria-labelledby="hero-title">
          <p className="eyebrow">给刚刚开始探索科研的你</p>
          <h1 id="hero-title">科研，<br />从一个问题开始。</h1>
          <p className="hero-description">
            不必一开始就有明确方向。这是一个可以一直用的工具：先花两分钟认识自己的兴趣与基础，
            再拿到一条能照着做的学习路线、和你方向匹配的教师资料，以及带来源的科研问答。
          </p>
          <div className="hero-actions">
            <Link className="button" href="/assessment">
              开始科研测评
            </Link>
            <Link className="button-secondary" href="/dashboard">
              查看成长首页
            </Link>
          </div>
          <p className="preview-note">
            为什么先做测评？后面的路线和资料都按你的回答来 —— 不做评价、不排名，也没有对错。
          </p>
          <p className="preview-note">
            测评、画像、学习路线、教师资料与科研问答都已上线。
            不需要注册，也不会收集姓名、学号或手机号。
          </p>
        </section>
        <section id="journey" className="journey" aria-labelledby="journey-title">
          <p className="eyebrow">一步一步，建立自己的方向</p>
          <h2 id="journey-title">从好奇，到第一次行动</h2>
          <ol className="step-grid">
            {steps.map((step, index) => (
              <li className="step-card" key={step.title}>
                <span className="step-number" aria-hidden="true">0{index + 1}</span>
                <h3>{step.title}</h3>
                <p>{step.description}</p>
              </li>
            ))}
          </ol>
        </section>
      </main>
      <footer className="container site-footer">科研小助理 · 深圳大学学生团队</footer>
    </>
  );
}
