import { NavLink, Route, Routes } from "react-router-dom";
import Dashboard from "./pages/Dashboard.jsx";
import Settings from "./pages/Settings.jsx";
import Alert from "./pages/Alert.jsx";

export default function App() {
  return (
    <div className="layout">
      <header>
        <h1>SportBet Odds Comparator</h1>
        <nav>
          <NavLink to="/">Dashboard</NavLink>
          <NavLink to="/settings">Settings</NavLink>
          <NavLink to="/alert">Alert</NavLink>
        </nav>
      </header>
      <main>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/alert" element={<Alert />} />
        </Routes>
      </main>
    </div>
  );
}
