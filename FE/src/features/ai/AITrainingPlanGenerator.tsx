import {
  useIsMutating,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { LoaderCircle, Sparkles } from "lucide-react";
import { ApiError } from "../../shared/api";
import { AIMarkdown } from "./AIMarkdown";
import { generateAIPlan } from "./api";

export function AITrainingPlanGenerator() {
  const cache = useQueryClient();
  const busy = useIsMutating({ mutationKey: ["ai-training-plan"] }) > 0;
  const mutation = useMutation({
    mutationKey: ["ai-training-plan"],
    mutationFn: generateAIPlan,
    retry: false,
    onSettled: () => {
      void cache.invalidateQueries({ queryKey: ["training-plans"] });
    },
  });
  return (
    <section className="panel ai-plan" aria-labelledby="ai-plan-title">
      <div>
        <p className="ai-eyebrow">KẾ HOẠCH CÁ NHÂN HÓA</p>
        <h2 id="ai-plan-title">Tập luyện cùng trợ lý AI</h2>
        <p>
          Lịch tập và dinh dưỡng 7 ngày dựa trên mục tiêu và trình độ trong hồ
          sơ của bạn.
        </p>
      </div>
      <button
        className="button primary"
        disabled={busy}
        onClick={() => {
          if (!cache.isMutating({ mutationKey: ["ai-training-plan"] }))
            mutation.mutate();
        }}
      >
        {busy ? (
          <LoaderCircle size={18} className="ai-spinner" aria-hidden="true" />
        ) : (
          <Sparkles size={18} aria-hidden="true" />
        )}
        {busy
          ? "AI đang phân tích thể trạng..."
          : "Tạo Lịch Tập Thông Minh Bằng AI"}
      </button>
      {busy && (
        <p role="status">
          Đang tạo và lưu kế hoạch. Quá trình này có thể mất vài giây.
        </p>
      )}
      {mutation.error && (
        <div className="error-state" role="alert">
          <p>{mutation.error.message}</p>
          {mutation.error instanceof ApiError &&
          mutation.error.status === 400 ? (
            <Link to="/member/profile">
              Cập nhật mục tiêu và trình độ trong hồ sơ
            </Link>
          ) : (
            <Link to="/member/training">
              Kiểm tra kế hoạch đã lưu trước khi thử lại
            </Link>
          )}
        </div>
      )}
      {mutation.data && (
        <>
          <p className="success" role="status">
            Đã tạo và lưu kế hoạch tập luyện thành công.
          </p>
          <h3>{mutation.data.name}</h3>
          <AIMarkdown>{mutation.data.description}</AIMarkdown>
          <Link to="/member/training">Xem tất cả kế hoạch tập luyện</Link>
        </>
      )}
    </section>
  );
}
