import { Activity } from "lucide-react";
export function Brand({ member = false }: { member?: boolean }) {
  return (
    <span className="brand">
      <span className="brand-mark">
        {member ? (
          <img src="/brand/pulse-member.svg" width={40} height={40} alt="" />
        ) : (
          <Activity size={25} strokeWidth={2.7} />
        )}
      </span>
      <span>
        pulse<span className="brand-dot">.</span>
        <small>SPORTS CENTER</small>
      </span>
    </span>
  );
}
