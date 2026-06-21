import { useNavigate } from "react-router-dom";

interface Props {
  icon: string;
  title: string;
  desc: string;
}

export function EmptyState({ icon, title, desc }: Props) {
  const navigate = useNavigate();
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-full border border-accent/20 bg-accent/5 text-5xl">
        {icon}
      </div>
      <h3 className="mb-3 text-2xl font-black">{title}</h3>
      <p className="mb-8 max-w-sm text-sm leading-relaxed text-slate-400">{desc}</p>
      <button
        onClick={() => navigate("/chat")}
        className="btn-primary text-sm glow"
      >
        ابدأ مع المساعد الذكي 🤖
      </button>
    </div>
  );
}
