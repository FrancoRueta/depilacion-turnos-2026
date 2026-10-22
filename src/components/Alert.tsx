import type { ReactNode } from "react";
import { AlertIcon, CheckCircleIcon, InfoIcon } from "./Icons";

type AlertTone = "info" | "success" | "danger" | "warning";

interface AlertProps {
  tone?: AlertTone;
  title?: string;
  children: ReactNode;
  action?: ReactNode;
}

export function Alert({ tone = "info", title, children, action }: AlertProps) {
  const Icon =
    tone === "success" ? CheckCircleIcon : tone === "danger" || tone === "warning" ? AlertIcon : InfoIcon;

  return (
    <div
      className={`alert alert--${tone}`}
      role={tone === "danger" || tone === "warning" ? "alert" : "status"}
    >
      <span className="alert__icon">
        <Icon size={20} />
      </span>
      <div className="alert__content">
        {title ? <strong className="alert__title">{title}</strong> : null}
        <div className="alert__message">{children}</div>
        {action ? <div className="alert__action">{action}</div> : null}
      </div>
    </div>
  );
}
