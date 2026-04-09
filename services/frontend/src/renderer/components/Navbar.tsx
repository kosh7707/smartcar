import React from "react";
import { Link, useLocation } from "react-router-dom";
import { Shield, Bell } from "lucide-react";
import "./Navbar.css";

export const Navbar: React.FC = () => {
  const location = useLocation();
  const isDashboard = location.pathname === "/dashboard";

  return (
    <header className="navbar">
      <div className="navbar-left">
        <Link to="/dashboard" className="navbar-brand" aria-label="AEGIS home">
          <span className="navbar-brand__icon">
            <Shield size={18} />
          </span>
        </Link>
        <Link
          to="/dashboard"
          className={`navbar-navlink${isDashboard ? " navbar-navlink--active" : ""}`}
          aria-current={isDashboard ? "page" : undefined}
        >
          Dashboard
        </Link>
      </div>

      <div className="navbar-actions">
        <button className="navbar-actions__btn" title="Notifications">
          <Bell size={16} />
        </button>
        <span className="navbar-actions__divider" />
        <div className="navbar-actions__avatar" title="Kosh (Admin)">K</div>
      </div>
    </header>
  );
};
