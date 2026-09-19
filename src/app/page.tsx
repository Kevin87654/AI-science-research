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
          <p className="hero-description">不必一开始就有明确方向。先认识自己的兴趣与基础，再找到一个可以完成的小行动。</p>
          <a className="button" href="#journey">了解成长路径 <span aria-hidden="true">↗</span></a>
          <p className="preview-note">当前为产品介绍预览，测评与学习路线将在后续开放。</p>
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
