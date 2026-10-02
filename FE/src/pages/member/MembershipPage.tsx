import { CancelSubscription } from "../../shared/CancelSubscription";
import { effectiveSubscription } from "../../shared/businessRules";
import { formatMemberDate } from "../../shared/memberFormat";
import { ErrorState } from "../../shared/feedback";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../../context/AuthContext";
import { membershipApi } from "../../api/membership.api";
import { CreditCard, Check } from "lucide-react";
import {
  LoadingSpinner,
  EmptyState,
  StatusBadge,
} from "../../components/common";

export function MembershipPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<"current" | "plans">("current");

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
  const plans = plansData?.plans || [];

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
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* HEADER */}
      <div
        style={{
          background: "var(--color-surface)",
          borderRadius: "var(--radius-card)",
          padding: "24px 28px",
          border: "1px solid #e7ece9",
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
              fontWeight: 700,
              color: "var(--color-primary)",
              margin: "0 0 6px",
            }}
          >
            Quản lý Gói hội viên
          </h1>
          <p
            style={{
              margin: 0,
              color: "var(--color-text-muted)",
              fontSize: "var(--font-small)",
            }}
          >
            Xem thông tin gói tập đang sử dụng, thời hạn còn lại và bảng giá các
            gói tập luyện tại Pulse Sports
          </p>
        </div>

        {activeSub && (
          <CancelSubscription subscription={activeSub} role="MEMBER" />
        )}
        {/* TABS */}
        <div
          style={{
            display: "flex",
            backgroundColor: "#f2f5f3",
            borderRadius: 8,
            padding: 3,
          }}
        >
          <button
            onClick={() => setTab("current")}
            style={{
              border: "none",
              background:
                tab === "current" ? "var(--color-surface)" : "transparent",
              color:
                tab === "current"
                  ? "var(--color-primary)"
                  : "var(--color-text-muted)",
              fontWeight: 700,
              fontSize: "var(--font-small)",
              padding: "8px 16px",
              borderRadius: 6,
              cursor: "pointer",
            }}
          >
            Gói của tôi
          </button>
          <button
            onClick={() => setTab("plans")}
            style={{
              border: "none",
              background:
                tab === "plans" ? "var(--color-surface)" : "transparent",
              color:
                tab === "plans"
                  ? "var(--color-primary)"
                  : "var(--color-text-muted)",
              fontWeight: 700,
              fontSize: "var(--font-small)",
              padding: "8px 16px",
              borderRadius: 6,
              cursor: "pointer",
            }}
          >
            Bảng giá các gói
          </button>
        </div>
      </div>

      {tab === "current" ? (
        /* CURRENT MEMBERSHIP TAB */
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {subLoading ? (
            <LoadingSpinner text="Đang kiểm tra gói hội viên..." />
          ) : subError ? (
            <ErrorState error={subError} />
          ) : activeSub ? (
            /* ACTIVE MEMBERSHIP HERO */
            <div
              style={{
                background: "linear-gradient(135deg, #203d31 0%, #152720 100%)",
                borderRadius: "var(--radius-card)",
                padding: "32px",
                color: "var(--color-surface)",
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
                      backgroundColor: "var(--color-secondary)",
                      color: "var(--color-primary)",
                      fontSize: "var(--font-caption)",
                      fontWeight: 700,
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
                      fontWeight: 700,
                      margin: "12px 0 6px",
                      color: "var(--color-surface)",
                    }}
                  >
                    {activeSub.plan?.name}
                  </h2>
                  <p
                    style={{
                      margin: 0,
                      color: "#b2c5bc",
                      fontSize: "var(--font-small)",
                    }}
                  >
                    {activeSub.plan?.description ||
                      "Toàn quyền sử dụng trang thiết bị và đăng ký các lớp học tiêu chuẩn."}
                  </p>
                </div>

                <div style={{ textAlign: "right" }}>
                  <div
                    style={{
                      fontSize: "var(--font-small)",
                      color: "#b2c5bc",
                      marginBottom: 4,
                    }}
                  >
                    Thời hạn còn lại
                  </div>
                  <div
                    style={{
                      fontSize: 32,
                      fontWeight: 700,
                      color: "var(--color-secondary)",
                    }}
                  >
                    {daysRemaining}{" "}
                    <span
                      style={{
                        fontSize: "var(--font-body)",
                        fontWeight: 600,
                        color: "var(--color-surface)",
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
                      fontSize: "var(--font-caption)",
                      color: "#8ca89b",
                    }}
                  >
                    Hạng hội viên
                  </div>
                  <div
                    style={{
                      fontSize: "var(--font-body)",
                      fontWeight: 700,
                      marginTop: 4,
                    }}
                  >
                    Hạng {activeSub.tier}
                  </div>
                </div>
                <div>
                  <div
                    style={{
                      fontSize: "var(--font-caption)",
                      color: "#8ca89b",
                    }}
                  >
                    Ngày bắt đầu
                  </div>
                  <div
                    style={{
                      fontSize: "var(--font-body)",
                      fontWeight: 700,
                      marginTop: 4,
                    }}
                  >
                    {formatMemberDate(activeSub.startDate)}
                  </div>
                </div>
                <div>
                  <div
                    style={{
                      fontSize: "var(--font-caption)",
                      color: "#8ca89b",
                    }}
                  >
                    Ngày kết thúc
                  </div>
                  <div
                    style={{
                      fontSize: "var(--font-body)",
                      fontWeight: 700,
                      marginTop: 4,
                    }}
                  >
                    {formatMemberDate(activeSub.endDate)}
                  </div>
                </div>
                <div>
                  <div
                    style={{
                      fontSize: "var(--font-caption)",
                      color: "#8ca89b",
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
                  onClick={() => setTab("plans")}
                  style={{
                    padding: "10px 20px",
                    backgroundColor: "var(--color-primary)",
                    color: "var(--color-surface)",
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

          {/* SUBSCRIPTION HISTORY */}
          <div
            style={{
              background: "var(--color-surface)",
              borderRadius: "var(--radius-card)",
              border: "1px solid #e7ece9",
              padding: 24,
            }}
          >
            <h3
              style={{
                fontSize: "var(--font-body)",
                fontWeight: 700,
                color: "var(--color-primary)",
                margin: "0 0 16px",
              }}
            >
              Lịch sử các gói hội viên
            </h3>

            {subscriptions.length === 0 ? (
              <div
                style={{
                  color: "var(--color-text-muted)",
                  fontSize: "var(--font-small)",
                }}
              >
                Chưa có lịch sử đăng ký gói nào.
              </div>
            ) : (
              <div
                style={{ display: "flex", flexDirection: "column", gap: 10 }}
              >
                {subscriptions.map((sub) => (
                  <div
                    key={sub.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "12px 16px",
                      borderRadius: 10,
                      backgroundColor: "#f9fbfa",
                      border: "1px solid #edf2ee",
                      flexWrap: "wrap",
                      gap: 12,
                    }}
                  >
                    <div>
                      <div
                        style={{
                          fontWeight: 700,
                          fontSize: "var(--font-small)",
                          color: "var(--color-primary)",
                        }}
                      >
                        {sub.plan?.name || "Gói tập"} ({sub.tier})
                      </div>
                      <div
                        style={{
                          fontSize: "var(--font-caption)",
                          color: "var(--color-text-muted)",
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
          </div>
        </div>
      ) : (
        /* MEMBERSHIP PLANS TAB */
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {plansLoading ? (
            <LoadingSpinner text="Đang tải danh sách gói tập..." />
          ) : plansError ? (
            <ErrorState error={plansError} />
          ) : plans.length === 0 ? (
            <EmptyState title="Hiện chưa có gói tập nào mở bán" />
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
                gap: 24,
              }}
            >
              {plans.map((p) => {
                const isPremium = p.tier === "PREMIUM";
                const priceFormatted = Number(p.price).toLocaleString("vi-VN");

                return (
                  <div
                    key={p.id}
                    style={{
                      backgroundColor: "var(--color-surface)",
                      borderRadius: 18,
                      border: isPremium
                        ? "2px solid #203d31"
                        : "1px solid #e7ece9",
                      padding: 28,
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                      position: "relative",
                      boxShadow: isPremium
                        ? "0 10px 25px -5px rgba(32, 61, 49, 0.12)"
                        : "0 2px 4px rgba(0, 0, 0, 0.02)",
                    }}
                  >
                    {isPremium && (
                      <span
                        style={{
                          position: "absolute",
                          top: -12,
                          right: 24,
                          backgroundColor: "var(--color-primary)",
                          color: "var(--color-secondary)",
                          fontSize: "var(--font-caption)",
                          fontWeight: 700,
                          padding: "3px 12px",
                          borderRadius: 999,
                          letterSpacing: 0.5,
                        }}
                      >
                        PHỔ BIẾN NHẤT
                      </span>
                    )}

                    <div>
                      <div
                        style={{
                          fontSize: "var(--font-small)",
                          fontWeight: 700,
                          color: "#376228",
                          marginBottom: 6,
                        }}
                      >
                        HẠNG {p.tier}
                      </div>
                      <h3
                        style={{
                          fontSize: 22,
                          fontWeight: 700,
                          color: "var(--color-primary)",
                          margin: "0 0 8px",
                        }}
                      >
                        {p.name}
                      </h3>
                      <p
                        style={{
                          fontSize: "var(--font-small)",
                          color: "var(--color-text-muted)",
                          lineHeight: 1.5,
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
                            color: "var(--color-primary)",
                          }}
                        >
                          {priceFormatted}
                        </span>
                        <span
                          style={{
                            fontSize: "var(--font-small)",
                            color: "var(--color-text-muted)",
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
                          fontSize: "var(--font-small)",
                          color: "#344054",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                          }}
                        >
                          <Check size={16} color="#267346" />
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
                          <Check size={16} color="#267346" />
                          <span>
                            Quyền đặt lịch lớp học:{" "}
                            <strong>Không giới hạn</strong>
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
                            <Check size={16} color="#267346" />
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
                          <Check size={16} color="#267346" />
                          <span>
                            Sử dụng tủ đồ, phòng tắm nước nóng miễn phí
                          </span>
                        </div>
                      </div>
                    </div>

                    <div
                      style={{
                        marginTop: 28,
                        paddingTop: 18,
                        borderTop: "1px solid #f2f5f3",
                      }}
                    >
                      <div
                        style={{
                          textAlign: "center",
                          fontSize: "var(--font-caption)",
                          color: "var(--color-text-muted)",
                          lineHeight: 1.4,
                          padding: "8px 12px",
                          backgroundColor: "#f9fbfa",
                          borderRadius: 8,
                        }}
                      >
                        ℹ️ Vui lòng liên hệ Lễ tân (Reception Desk) hoặc Hotline
                        trung tâm để đăng ký / gia hạn trực tiếp qua chuyển
                        khoản hoặc tiền mặt.
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
