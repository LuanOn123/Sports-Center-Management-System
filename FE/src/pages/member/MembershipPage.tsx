import { getFacilityId } from "../../shared/facility";
import { CancelSubscription } from "../../shared/CancelSubscription";
import "./membership.css";
import {
  effectiveSubscription,
  isEffectiveSubscription,
} from "../../shared/businessRules";
import { formatMemberDate } from "../../shared/memberFormat";
import { ErrorState } from "../../shared/feedback";
import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useAuth } from "../../context/AuthContext";
import { membershipApi } from "../../api/membership.api";
import { sepayApi } from "../../api/sepay.api";
import { SepayCheckoutModal } from "../../shared/SepayCheckout";
import type { MembershipPlan, SepayCheckout } from "../../types/member";
import { CreditCard, Check, QrCode } from "lucide-react";
import { Modal } from "../../shared/ui";
import {
  LoadingSpinner,
  EmptyState,
  StatusBadge,
} from "../../components/common";

export function MembershipPage() {
  const { user } = useAuth();
  const [paymentPlan, setPaymentPlan] = useState<MembershipPlan | null>(null);
  const [transitionPlan, setTransitionPlan] = useState<MembershipPlan | null>(
    null,
  );
  const [upgradeOption, setUpgradeOption] = useState<"immediate" | "scheduled">(
    "immediate",
  );
  const [customStartDate, setCustomStartDate] = useState<string>("");
  const storageKey = `pulse.pending-checkout.${user?.id}.${getFacilityId()}`;
  const [checkout, setCheckout] = useState<SepayCheckout | null>(() => {
    try {
      return JSON.parse(sessionStorage.getItem(storageKey) || "null");
    } catch {
      return null;
    }
  });
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  useEffect(() => {
    if (checkout) sessionStorage.setItem(storageKey, JSON.stringify(checkout));
  }, [checkout, storageKey]);
  const createCheckout = useMutation({
    mutationFn: ({
      planId,
      startDate,
    }: {
      planId: string;
      startDate?: string;
    }) => sepayApi.createCheckout(planId, startDate),
    onSuccess: (data) => {
      setCheckout(data);
      setCheckoutOpen(true);
      setTransitionPlan(null);
    },
    onError: (error) => {
      const pending = sepayApi.pendingCheckoutFromError(error);
      if (pending) {
        setCheckout(pending);
        setCheckoutOpen(true);
        setTransitionPlan(null);
      }
    },
  });

  const startCheckout = (plan: MembershipPlan, startDate?: string) => {
    setPaymentPlan(plan);
    setCheckout(null);
    createCheckout.reset();
    createCheckout.mutate({ planId: plan.id, startDate });
  };

  const closeCheckout = () => {
    setCheckoutOpen(false);
    createCheckout.reset();
  };

  // Fetch current user subscriptions
  const {
    data: subData,
    isLoading: subLoading,
    error: subError,
  } = useQuery({
    queryKey: ["current-membership", user?.id],
    queryFn: () =>
      user?.id ? membershipApi.getMySubscriptions(user.id) : null,
    enabled: Boolean(user?.id),
    refetchOnWindowFocus: "always",
  });

  // Fetch all plans
  const {
    data: plansData,
    isLoading: plansLoading,
    error: plansError,
  } = useQuery({
    queryKey: ["membership-plans"],
    queryFn: () => membershipApi.getPlans(),
  });

  const subscriptions = subData?.subscriptions || [];
  const activeSub = effectiveSubscription(subData?.subscriptions || []);
  const scheduledSub = subscriptions.find((s) => s.status === "SCHEDULED");
  const plans = (plansData?.plans || []).filter(
    (plan) => plan.tier !== "FREE" && Number(plan.price) > 0,
  );

  const rank: Record<string, number> = { FREE: 0, MEMBERSHIP: 1, PREMIUM: 2 };

  const daysRemaining = activeSub
    ? Math.max(
        0,
        Math.ceil(
          (new Date(activeSub.endDate).getTime() - new Date().getTime()) /
            (1000 * 60 * 60 * 24),
        ),
      )
    : 0;

  return (
    <div
      className="membership-page"
      style={{ display: "flex", flexDirection: "column", gap: 24 }}
    >
      {/* HEADER */}
      <div
        style={{
          background: "var(--member-surface, #ffffff)",
          borderRadius: 16,
          padding: "24px 28px",
          border: "1px solid var(--member-border, #e7ece9)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 16,
        }}
      >
        <div>
          <h1
            style={{
              fontSize: 24,
              fontWeight: 800,
              color: "var(--member-text, #203d31)",
              margin: "0 0 6px",
            }}
          >
            Quản lý Gói hội viên
          </h1>
          <p
            style={{
              margin: 0,
              color: "var(--member-muted, #58695f)",
              fontSize: 13,
            }}
          >
            Xem thông tin gói tập đang sử dụng, thời hạn còn lại và bảng giá các
            gói tập luyện tại Pulse Sports
          </p>
        </div>

        {activeSub && activeSub.tier !== "FREE" && (
          <CancelSubscription subscription={activeSub} role="MEMBER" />
        )}
        <a className="button" href="#membership-plans">
          Xem bảng giá các gói
        </a>
      </div>

      {/* GÓI ĐANG DÙNG */}
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {subLoading ? (
          <LoadingSpinner text="Đang kiểm tra gói hội viên..." />
        ) : subError ? (
          <ErrorState error={subError} />
        ) : activeSub?.tier === "FREE" ? (
          <section
            className="membership-free-summary"
            aria-label="Gói hiện tại"
          >
            <div>
              <span className="membership-eyebrow">GÓI HIỆN TẠI</span>
              <h2>Tài khoản Free</h2>
              <p>
                Được cấp tự động khi tạo tài khoản. Bạn có thể check-in cơ sở;
                gói Free chưa bao gồm quyền đăng ký lớp học.
              </p>
            </div>
            <a className="button primary" href="#membership-plans">
              Khám phá gói tập
            </a>
          </section>
        ) : activeSub ? (
          /* ACTIVE MEMBERSHIP HERO */
          <div
            className="member-active-plan"
            style={{
              background:
                "linear-gradient(135deg, var(--member-surface, #203d31) 0%, var(--member-surface-alt, #152720) 100%)",
              borderRadius: 20,
              padding: "32px",
              color: "var(--member-text, #ffffff)",
              boxShadow: "0 10px 25px -5px rgba(32, 61, 49, 0.2)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                flexWrap: "wrap",
                gap: 12,
                marginBottom: 16,
              }}
            >
              <div>
                <span
                  style={{
                    backgroundColor: "var(--member-accent, #d3f879)",
                    color: "var(--member-ink, #203d31)",
                    fontSize: 12,
                    fontWeight: 800,
                    padding: "4px 10px",
                    borderRadius: 6,
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                  }}
                >
                  GÓI ĐANG HOẠT ĐỘNG
                </span>
                <h2
                  style={{
                    fontSize: 28,
                    fontWeight: 800,
                    margin: "12px 0 6px",
                    color: "var(--member-text, #ffffff)",
                  }}
                >
                  {activeSub.planNameSnapshot ?? activeSub.plan?.name}
                </h2>
                <p
                  style={{
                    margin: 0,
                    color: "var(--member-muted, #b2c5bc)",
                    fontSize: 14,
                  }}
                >
                  {activeSub.plan?.description ||
                    "Quyền lợi có hiệu lực tại mọi cơ sở. Giới hạn lớp được tính chung trên toàn hệ thống."}
                </p>
              </div>

              <div style={{ textAlign: "right" }}>
                <div
                  style={{
                    fontSize: 13,
                    color: "var(--member-muted, #b2c5bc)",
                    marginBottom: 4,
                  }}
                >
                  Thời hạn còn lại
                </div>
                <div
                  style={{
                    fontSize: 32,
                    fontWeight: 800,
                    color: "var(--member-accent, #d3f879)",
                  }}
                >
                  {daysRemaining}{" "}
                  <span
                    style={{
                      fontSize: 16,
                      fontWeight: 600,
                      color: "var(--member-text, #ffffff)",
                    }}
                  >
                    ngày
                  </span>
                </div>
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                gap: 16,
                paddingTop: 24,
                borderTop: "1px solid rgba(255, 255, 255, 0.12)",
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: 12,
                    color: "var(--member-muted, #8ca89b)",
                  }}
                >
                  Hạng hội viên
                </div>
                <div style={{ fontSize: 16, fontWeight: 700, marginTop: 4 }}>
                  Hạng {activeSub.tier}
                </div>
              </div>
              <div>
                <div
                  style={{
                    fontSize: 12,
                    color: "var(--member-muted, #8ca89b)",
                  }}
                >
                  Ngày bắt đầu
                </div>
                <div style={{ fontSize: 16, fontWeight: 700, marginTop: 4 }}>
                  {formatMemberDate(activeSub.startDate)}
                </div>
              </div>
              <div>
                <div
                  style={{
                    fontSize: 12,
                    color: "var(--member-muted, #8ca89b)",
                  }}
                >
                  Ngày kết thúc
                </div>
                <div style={{ fontSize: 16, fontWeight: 700, marginTop: 4 }}>
                  {formatMemberDate(activeSub.endDate)}
                </div>
              </div>
              <div>
                <div
                  style={{
                    fontSize: 12,
                    color: "var(--member-muted, #8ca89b)",
                  }}
                >
                  Trạng thái
                </div>
                <div style={{ marginTop: 4 }}>
                  <StatusBadge status={activeSub.status} />
                </div>
              </div>
            </div>
          </div>
        ) : (
          <EmptyState
            icon={<CreditCard size={40} />}
            title="Bạn chưa có gói hội viên đang kích hoạt"
            description="Hãy xem Bảng giá các gói để đăng ký gói tập luyện phù hợp với mục tiêu của bạn."
            action={
              <button
                className="member-button member-button-primary"
                onClick={() =>
                  document
                    .getElementById("membership-plans")
                    ?.scrollIntoView({ block: "start" })
                }
                style={{
                  padding: "10px 20px",
                  backgroundColor: "var(--member-surface-alt, #203d31)",
                  color: "var(--member-text, #ffffff)",
                  borderRadius: 8,
                  border: "none",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Xem các gói tập ngay
              </button>
            }
          />
        )}

        {/* NEXT UP / SCHEDULED MEMBERSHIP CARD */}
        {scheduledSub && (
          <div
            className="member-scheduled-plan"
            style={{
              background:
                "linear-gradient(135deg, rgba(99, 102, 241, 0.08) 0%, rgba(139, 92, 246, 0.04) 100%)",
              borderRadius: 20,
              border: "2px solid #818cf8",
              padding: "28px 32px",
              boxShadow: "0 8px 20px -4px rgba(99, 102, 241, 0.15)",
              display: "flex",
              flexDirection: "column",
              gap: 16,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                flexWrap: "wrap",
                gap: 12,
              }}
            >
              <div>
                <span
                  style={{
                    backgroundColor: "#4f46e5",
                    color: "#ffffff",
                    fontSize: 12,
                    fontWeight: 800,
                    padding: "4px 10px",
                    borderRadius: 6,
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  NEXT UP · SẮP CÓ HIỆU LỰC
                </span>
                <h3
                  style={{
                    fontSize: 24,
                    fontWeight: 800,
                    margin: "10px 0 4px",
                    color: "var(--member-text, #203d31)",
                  }}
                >
                  {scheduledSub.planNameSnapshot ?? scheduledSub.plan?.name}
                </h3>
                <p
                  style={{
                    margin: 0,
                    color: "var(--member-muted, #58695f)",
                    fontSize: 13,
                  }}
                >
                  Gói tập này đã được thanh toán và lên lịch sẵn. Hệ thống sẽ tự
                  động kích hoạt vào ngày bắt đầu.
                </p>
              </div>
              <div style={{ textAlign: "right" }}>
                <span
                  className="badge info"
                  style={{
                    backgroundColor: "rgba(99, 102, 241, 0.15)",
                    color: "var(--member-info, #4f46e5)",
                    fontWeight: 700,
                    padding: "6px 12px",
                    borderRadius: 8,
                    fontSize: 13,
                  }}
                >
                  SCHEDULED
                </span>
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                gap: 16,
                paddingTop: 16,
                borderTop: "1px solid rgba(99, 102, 241, 0.15)",
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: 12,
                    color: "var(--member-muted, #58695f)",
                  }}
                >
                  Hạng gói
                </div>
                <div style={{ fontSize: 15, fontWeight: 700, marginTop: 4 }}>
                  Hạng {scheduledSub.tier}
                </div>
              </div>
              <div>
                <div
                  style={{
                    fontSize: 12,
                    color: "var(--member-muted, #58695f)",
                  }}
                >
                  Ngày kích hoạt dự kiến
                </div>
                <div
                  style={{
                    fontSize: 15,
                    fontWeight: 700,
                    marginTop: 4,
                    color: "var(--member-info, #4f46e5)",
                  }}
                >
                  {formatMemberDate(scheduledSub.startDate)}
                </div>
              </div>
              <div>
                <div
                  style={{
                    fontSize: 12,
                    color: "var(--member-muted, #58695f)",
                  }}
                >
                  Ngày hết hạn dự kiến
                </div>
                <div style={{ fontSize: 15, fontWeight: 700, marginTop: 4 }}>
                  {formatMemberDate(scheduledSub.endDate)}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      <section
        id="membership-plans"
        aria-label="Bảng giá các gói"
        style={{ display: "flex", flexDirection: "column", gap: 20 }}
      >
        <div className="membership-pricing-heading">
          <div>
            <h2>Bảng giá các gói tập</h2>
            <p>So sánh quyền lợi và chọn gói phù hợp với lịch tập của bạn.</p>
          </div>
          <span>
            <QrCode size={18} aria-hidden="true" /> Thanh toán VietQR
          </span>
        </div>
        {plansLoading ? (
          <LoadingSpinner text="Đang tải danh sách gói tập..." />
        ) : plansError ? (
          <ErrorState error={plansError} />
        ) : plans.length === 0 ? (
          <EmptyState title="Hiện chưa có gói tập nào mở bán" />
        ) : (
          <div className="membership-plan-grid">
            {plans.map((p) => {
              const isPremium = p.tier === "PREMIUM";
              const isRenewal = Boolean(
                activeSub &&
                (activeSub.planId === p.id ||
                  (activeSub.tier === p.tier &&
                    Number(p.durationDays) ===
                      Number(
                        activeSub.durationDaysSnapshot ??
                          activeSub.plan?.durationDays,
                      ))),
              );
              const isUpgrade = Boolean(
                activeSub && (rank[p.tier] ?? 0) > (rank[activeSub.tier] ?? 0),
              );
              const isDowngrade = Boolean(
                activeSub &&
                ((rank[p.tier] ?? 0) < (rank[activeSub.tier] ?? 0) ||
                  (p.tier === activeSub.tier &&
                    Number(p.durationDays) <
                      Number(
                        activeSub.durationDaysSnapshot ??
                          activeSub.plan?.durationDays,
                      ))),
              );
              const registered = subscriptions.find(
                (s) => s.planId === p.id && isEffectiveSubscription(s),
              );
              const priceFormatted = Number(p.price).toLocaleString("vi-VN");

              return (
                <div
                  key={p.id}
                  className={`membership-plan-card ${isPremium ? "premium" : ""}`}
                >
                  {isPremium && (
                    <span
                      style={{
                        position: "absolute",
                        top: -12,
                        right: 24,
                        backgroundColor: "var(--member-surface-alt, #203d31)",
                        color: "var(--member-accent, #d3f879)",
                        fontSize: 11,
                        fontWeight: 800,
                        padding: "3px 12px",
                        borderRadius: 999,
                        letterSpacing: 0.5,
                      }}
                    >
                      TRẢI NGHIỆM PREMIUM
                    </span>
                  )}

                  <div>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 700,
                        color: "var(--member-accent, #376228)",
                        marginBottom: 6,
                      }}
                    >
                      HẠNG {p.tier}
                    </div>
                    <h3
                      style={{
                        fontSize: 22,
                        fontWeight: 800,
                        color: "var(--member-text, #203d31)",
                        margin: "0 0 8px",
                      }}
                    >
                      {p.name}
                    </h3>
                    {registered && (
                      <p className="membership-daily">
                        <Check size={14} /> Đang sử dụng · đến{" "}
                        {formatMemberDate(registered.endDate)}
                      </p>
                    )}
                    {Number(p.price) > 0 && p.durationDays > 0 && (
                      <div className="membership-daily">
                        Khoảng{" "}
                        <strong>
                          {Math.round(
                            Number(p.price) / p.durationDays,
                          ).toLocaleString("vi-VN")}{" "}
                          đ/ngày
                        </strong>{" "}
                        · {p.durationDays} ngày tập luyện
                      </div>
                    )}
                    <p
                      style={{
                        fontSize: 13,
                        color: "var(--member-muted, #667085)",
                        lineHeight: 1.65,
                        whiteSpace: "pre-line",
                        margin: "0 0 20px",
                      }}
                    >
                      {p.description ||
                        "Gói tập toàn diện giúp học viên thoải mái trải nghiệm cơ sở vật chất và các lớp học chuyên sâu."}
                    </p>

                    <div style={{ marginBottom: 24 }}>
                      <span
                        style={{
                          fontSize: 32,
                          fontWeight: 900,
                          color: "var(--member-text, #203d31)",
                        }}
                      >
                        {priceFormatted}
                      </span>
                      <span
                        style={{
                          fontSize: 14,
                          color: "var(--member-muted, #58695f)",
                          marginLeft: 4,
                        }}
                      >
                        VNĐ / {p.durationDays} ngày
                      </span>
                    </div>

                    {/* Benefits */}
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 10,
                        fontSize: 13,
                        color: "var(--member-text, #344054)",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                        }}
                      >
                        <Check
                          size={16}
                          color="var(--member-success, #267346)"
                        />
                        <span>
                          Thời hạn sử dụng:{" "}
                          <strong>{p.durationDays} ngày</strong>
                        </span>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                        }}
                      >
                        <Check
                          size={16}
                          color="var(--member-success, #267346)"
                        />
                        <span>
                          Quyền đặt lịch lớp học:{" "}
                          <strong>
                            {p.maxConcurrentClasses ??
                              (p.tier === "FREE"
                                ? 0
                                : p.tier === "PREMIUM"
                                  ? 6
                                  : 3)}{" "}
                            lớp song song trên mọi cơ sở
                          </strong>
                        </span>
                      </div>
                      {isPremium && (
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                          }}
                        >
                          <Check
                            size={16}
                            color="var(--member-success, #267346)"
                          />
                          <span>
                            Mở khóa toàn bộ các lớp{" "}
                            <strong>Premium Class ★</strong>
                          </span>
                        </div>
                      )}
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                        }}
                      >
                        <Check
                          size={16}
                          color="var(--member-success, #267346)"
                        />
                        <span>
                          Quyền lợi áp dụng tại mọi cơ sở trong hệ thống
                        </span>
                      </div>
                    </div>
                  </div>

                  <div
                    style={{
                      marginTop: 28,
                      paddingTop: 18,
                      borderTop: "1px solid var(--member-surface-alt, #f2f5f3)",
                    }}
                  >
                    <button
                      className="button primary"
                      style={{ width: "100%", justifyContent: "center" }}
                      disabled={
                        subLoading ||
                        Boolean(subError) ||
                        Number(p.price) <= 0 ||
                        createCheckout.isPending
                      }
                      onClick={() => {
                        if (activeSub) {
                          setTransitionPlan(p);
                          if (isDowngrade) {
                            setCustomStartDate(activeSub.endDate.slice(0, 10));
                          } else if (isUpgrade) {
                            setUpgradeOption("immediate");
                            setCustomStartDate(
                              new Date().toISOString().slice(0, 10),
                            );
                          } else {
                            setCustomStartDate(activeSub.endDate.slice(0, 10));
                          }
                        } else {
                          startCheckout(p);
                        }
                      }}
                    >
                      <QrCode size={17} />
                      {createCheckout.isPending && paymentPlan?.id === p.id
                        ? "Đang tạo mã..."
                        : isRenewal
                          ? "Gia hạn qua VietQR"
                          : isUpgrade
                            ? "Nâng cấp qua VietQR"
                            : isDowngrade
                              ? "Lên lịch gói (Hạ cấp)"
                              : "Chuyển khoản VietQR"}
                    </button>
                    {isDowngrade && activeSub && (
                      <p
                        className="field-note"
                        style={{
                          color: "var(--member-info, #4f46e5)",
                          fontSize: 12,
                        }}
                      >
                        Gói sẽ kích hoạt sau ngày{" "}
                        {formatMemberDate(activeSub.endDate)}
                      </p>
                    )}
                    {isRenewal && activeSub && (
                      <p
                        className="field-note"
                        style={{
                          color: "var(--member-success, #059669)",
                          fontSize: 12,
                        }}
                      >
                        Gia hạn tự động nối tiếp sau{" "}
                        {formatMemberDate(activeSub.endDate)}
                      </p>
                    )}
                    <p
                      style={{
                        textAlign: "center",
                        fontSize: 11,
                        color: "var(--member-muted, #667085)",
                        lineHeight: 1.4,
                        margin: "10px 0 0",
                      }}
                    >
                      Quét mã bằng ứng dụng ngân hàng. Sau khi nhận tiền, hệ
                      thống sẽ kích hoạt gói hoặc lên lịch kích hoạt tự động
                      theo lựa chọn của bạn.
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <p className="field-note">
          Giới hạn lớp được tính chung trên toàn hệ thống. Nhiều buổi thuộc cùng
          một lớp chỉ tính là một lớp. Đăng ký phụ thuộc vào chỗ trống, lịch học
          và thời hạn gói.
        </p>
      </section>

      {/* SUBSCRIPTION HISTORY */}
      <details
        style={{
          background: "var(--member-surface, #ffffff)",
          borderRadius: 16,
          border: "1px solid var(--member-border, #e7ece9)",
          padding: 24,
        }}
      >
        <summary
          style={{
            fontSize: 16,
            fontWeight: 700,
            color: "var(--member-text, #203d31)",
            margin: "0 0 16px",
          }}
        >
          Lịch sử các gói hội viên
        </summary>

        {subscriptions.length === 0 ? (
          <div style={{ color: "var(--member-muted, #58695f)", fontSize: 13 }}>
            Chưa có lịch sử đăng ký gói nào.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {subscriptions.map((sub) => (
              <div
                key={sub.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "12px 16px",
                  borderRadius: 10,
                  backgroundColor: "var(--member-surface-alt, #f9fbfa)",
                  border: "1px solid var(--member-border, #edf2ee)",
                  flexWrap: "wrap",
                  gap: 12,
                }}
              >
                <div>
                  <div
                    style={{
                      fontWeight: 700,
                      fontSize: 14,
                      color: "var(--member-text, #203d31)",
                    }}
                  >
                    {sub.planNameSnapshot ?? sub.plan?.name ?? "Gói tập"} (
                    {sub.tier})
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: "var(--member-muted, #58695f)",
                      marginTop: 2,
                    }}
                  >
                    {formatMemberDate(sub.startDate)} -{" "}
                    {formatMemberDate(sub.endDate)}
                  </div>
                </div>
                <StatusBadge status={sub.status} />
              </div>
            ))}
          </div>
        )}
      </details>

      {/* PLAN TRANSITION & SMART DATE PICKER MODAL */}
      {transitionPlan && activeSub && (
        <Modal
          eyebrow="CHUYỂN ĐỔI / GIA HẠN GÓI"
          title={
            activeSub.planId === transitionPlan.id ||
            (activeSub.tier === transitionPlan.tier &&
              Number(transitionPlan.durationDays) ===
                Number(
                  activeSub.durationDaysSnapshot ??
                    activeSub.plan?.durationDays,
                ))
              ? "Gia hạn gói tập"
              : (rank[transitionPlan.tier] ?? 0) > (rank[activeSub.tier] ?? 0)
                ? "Nâng cấp gói tập"
                : "Lên lịch gói tập tiếp theo (Hạ cấp)"
          }
          onClose={() => setTransitionPlan(null)}
          maxWidth={520}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div
              style={{
                padding: "14px 18px",
                borderRadius: 12,
                background: "var(--member-surface-alt, #f8fafc)",
                border: "1px solid var(--member-border, #e2e8f0)",
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: "var(--member-accent, #376228)",
                  textTransform: "uppercase",
                }}
              >
                Hạng {transitionPlan.tier}
              </div>
              <h4
                style={{
                  margin: "4px 0",
                  fontSize: 18,
                  color: "var(--member-text, #203d31)",
                }}
              >
                {transitionPlan.name}
              </h4>
              <div
                style={{ fontSize: 13, color: "var(--member-muted, #64748b)" }}
              >
                Thời hạn: <strong>{transitionPlan.durationDays} ngày</strong> ·
                Giá:{" "}
                <strong>
                  {Number(transitionPlan.price).toLocaleString("vi-VN")} VNĐ
                </strong>
              </div>
            </div>

            {/* RENEWAL NOTICE */}
            {(activeSub.planId === transitionPlan.id ||
              (activeSub.tier === transitionPlan.tier &&
                Number(transitionPlan.durationDays) ===
                  Number(
                    activeSub.durationDaysSnapshot ??
                      activeSub.plan?.durationDays,
                  ))) && (
              <div
                style={{
                  background: "rgba(16, 185, 129, 0.08)",
                  border: "1px solid rgba(16, 185, 129, 0.3)",
                  borderRadius: 10,
                  padding: 14,
                }}
              >
                <strong
                  style={{
                    color: "var(--member-success, #059669)",
                    display: "block",
                    marginBottom: 4,
                  }}
                >
                  ✓ Tự động gia hạn nối tiếp
                </strong>
                <p
                  style={{
                    margin: 0,
                    fontSize: 13,
                    color: "var(--member-text, #203d31)",
                  }}
                >
                  Gói mới sẽ tự động nối tiếp thời hạn gói hiện tại, kích hoạt
                  vào ngày{" "}
                  <strong>{formatMemberDate(activeSub.endDate)}</strong>. Bạn
                  không bị mất ngày tập nào.
                </p>
              </div>
            )}

            {/* UPGRADE NOTICE & CHOICE */}
            {(rank[transitionPlan.tier] ?? 0) > (rank[activeSub.tier] ?? 0) && (
              <div
                style={{ display: "flex", flexDirection: "column", gap: 12 }}
              >
                <label
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 10,
                    cursor: "pointer",
                    padding: "10px 14px",
                    borderRadius: 8,
                    border:
                      upgradeOption === "immediate"
                        ? "2px solid #10b981"
                        : "1px solid var(--member-border, #e2e8f0)",
                    background:
                      upgradeOption === "immediate"
                        ? "rgba(16, 185, 129, 0.04)"
                        : "transparent",
                  }}
                >
                  <input
                    type="radio"
                    name="upgradeOption"
                    checked={upgradeOption === "immediate"}
                    onChange={() => setUpgradeOption("immediate")}
                    style={{ marginTop: 3 }}
                  />
                  <div>
                    <strong
                      style={{
                        color: "var(--member-text, #203d31)",
                        display: "block",
                      }}
                    >
                      Kích hoạt ngay hôm nay
                    </strong>
                    <small style={{ color: "var(--member-muted, #64748b)" }}>
                      Hưởng ngay quyền lợi hạng {transitionPlan.tier} cao hơn kể
                      từ hôm nay.
                    </small>
                  </div>
                </label>
                <label
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 10,
                    cursor: "pointer",
                    padding: "10px 14px",
                    borderRadius: 8,
                    border:
                      upgradeOption === "scheduled"
                        ? "2px solid #3b82f6"
                        : "1px solid var(--member-border, #e2e8f0)",
                    background:
                      upgradeOption === "scheduled"
                        ? "rgba(59, 130, 246, 0.04)"
                        : "transparent",
                  }}
                >
                  <input
                    type="radio"
                    name="upgradeOption"
                    checked={upgradeOption === "scheduled"}
                    onChange={() => setUpgradeOption("scheduled")}
                    style={{ marginTop: 3 }}
                  />
                  <div style={{ flex: 1 }}>
                    <strong
                      style={{
                        color: "var(--member-text, #203d31)",
                        display: "block",
                      }}
                    >
                      Chọn ngày kích hoạt trong tương lai
                    </strong>
                    <small style={{ color: "var(--member-muted, #64748b)" }}>
                      Lên lịch bắt đầu gói nâng cấp vào một ngày cụ thể (từ hôm
                      nay trở đi).
                    </small>
                    {upgradeOption === "scheduled" && (
                      <div style={{ marginTop: 10 }}>
                        <input
                          type="date"
                          min={new Date().toISOString().slice(0, 10)}
                          value={
                            customStartDate ||
                            new Date().toISOString().slice(0, 10)
                          }
                          onChange={(e) => setCustomStartDate(e.target.value)}
                          style={{
                            padding: "6px 10px",
                            borderRadius: 6,
                            border: "1px solid var(--member-border, #cbd5e1)",
                            width: "100%",
                          }}
                        />
                      </div>
                    )}
                  </div>
                </label>
              </div>
            )}

            {/* DOWNGRADE NOTICE */}
            {((rank[transitionPlan.tier] ?? 0) < (rank[activeSub.tier] ?? 0) ||
              (transitionPlan.tier === activeSub.tier &&
                Number(transitionPlan.durationDays) <
                  Number(
                    activeSub.durationDaysSnapshot ??
                      activeSub.plan?.durationDays,
                  ))) && (
              <div
                style={{ display: "flex", flexDirection: "column", gap: 14 }}
              >
                <div
                  style={{
                    background: "rgba(99, 102, 241, 0.08)",
                    border: "1px solid rgba(99, 102, 241, 0.3)",
                    borderRadius: 10,
                    padding: 14,
                  }}
                >
                  <strong
                    style={{
                      color: "var(--member-info, #4f46e5)",
                      display: "block",
                      marginBottom: 4,
                    }}
                  >
                    📅 Đăng ký gói tiếp theo (SCHEDULED)
                  </strong>
                  <p
                    style={{
                      margin: 0,
                      fontSize: 13,
                      color: "var(--member-text, #203d31)",
                    }}
                  >
                    Gói hạ cấp sẽ được lưu ở trạng thái{" "}
                    <strong>SCHEDULED</strong> và chỉ có hiệu lực sau khi gói
                    hiện tại kết thúc vào ngày{" "}
                    <strong>{formatMemberDate(activeSub.endDate)}</strong>.
                  </p>
                </div>
                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: 13,
                      fontWeight: 600,
                      marginBottom: 6,
                    }}
                  >
                    Ngày bắt đầu kích hoạt:
                  </label>
                  <input
                    type="date"
                    min={activeSub.endDate.slice(0, 10)}
                    value={customStartDate || activeSub.endDate.slice(0, 10)}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    style={{
                      padding: "8px 12px",
                      borderRadius: 6,
                      border: "1px solid var(--member-border, #cbd5e1)",
                      width: "100%",
                    }}
                  />
                  <small
                    style={{
                      color: "var(--member-muted, #64748b)",
                      display: "block",
                      marginTop: 4,
                    }}
                  >
                    Phải từ ngày kết thúc của gói hiện tại (
                    {formatMemberDate(activeSub.endDate)}) trở đi.
                  </small>
                </div>
              </div>
            )}

            {createCheckout.error && (
              <div className="danger-text" style={{ fontSize: 13 }}>
                {String(createCheckout.error)}
              </div>
            )}

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: 10,
                marginTop: 12,
              }}
            >
              <button
                className="button"
                onClick={() => setTransitionPlan(null)}
              >
                Hủy
              </button>
              <button
                className="button primary"
                disabled={createCheckout.isPending}
                onClick={() => {
                  const isTUpgrade =
                    (rank[transitionPlan.tier] ?? 0) >
                    (rank[activeSub.tier] ?? 0);
                  const isTDowngrade =
                    (rank[transitionPlan.tier] ?? 0) <
                      (rank[activeSub.tier] ?? 0) ||
                    (transitionPlan.tier === activeSub.tier &&
                      Number(transitionPlan.durationDays) <
                        Number(
                          activeSub.durationDaysSnapshot ??
                            activeSub.plan?.durationDays,
                        ));
                  let finalStart: string | undefined;
                  if (isTUpgrade) {
                    finalStart =
                      upgradeOption === "immediate"
                        ? undefined
                        : customStartDate;
                  } else if (isTDowngrade) {
                    finalStart =
                      customStartDate || activeSub.endDate.slice(0, 10);
                  } else {
                    finalStart = activeSub.endDate.slice(0, 10);
                  }
                  startCheckout(transitionPlan, finalStart);
                }}
              >
                {createCheckout.isPending
                  ? "Đang tạo mã thanh toán..."
                  : "Tiếp tục tạo VietQR"}
              </button>
            </div>
          </div>
        </Modal>
      )}

      <SepayCheckoutModal
        checkout={checkout}
        open={checkoutOpen}
        onConfirmed={() => sessionStorage.removeItem(storageKey)}
        selectedPlan={paymentPlan}
        onClose={closeCheckout}
        onCreateNew={() => {
          const plan =
            paymentPlan ?? plans.find((p) => p.id === checkout?.plan?.id);
          if (plan) startCheckout(plan);
        }}
      />
      {checkout && !checkoutOpen && (
        <button className="button" onClick={() => setCheckoutOpen(true)}>
          Xem trạng thái giao dịch {checkout.orderCode}
        </button>
      )}
    </div>
  );
}
