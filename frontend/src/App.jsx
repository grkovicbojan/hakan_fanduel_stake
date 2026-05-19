import { Navigate, Route, Routes } from "react-router-dom";
import SiteLayout from "./components/SiteLayout.jsx";
import Home from "./pages/Home.jsx";
import About from "./pages/About.jsx";
import HowItWorks from "./pages/HowItWorks.jsx";
import Guides from "./pages/Guides.jsx";
import OddsFormatsGuide from "./pages/guides/OddsFormatsGuide.jsx";
import ImpliedProbabilityGuide from "./pages/guides/ImpliedProbabilityGuide.jsx";
import ArbitrageResearchGuide from "./pages/guides/ArbitrageResearchGuide.jsx";
import PlayerPropsGuide from "./pages/guides/PlayerPropsGuide.jsx";
import ResponsibleGamblingGuide from "./pages/guides/ResponsibleGamblingGuide.jsx";
import Privacy from "./pages/Privacy.jsx";
import Terms from "./pages/Terms.jsx";
import Contact from "./pages/Contact.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Settings from "./pages/Settings.jsx";
import Alert from "./pages/Alert.jsx";

export default function App() {
  return (
    <Routes>
      <Route element={<SiteLayout />}>
        <Route index element={<Home />} />
        <Route path="about" element={<About />} />
        <Route path="how-it-works" element={<HowItWorks />} />
        <Route path="guides" element={<Guides />} />
        <Route path="guides/odds-formats" element={<OddsFormatsGuide />} />
        <Route path="guides/implied-probability" element={<ImpliedProbabilityGuide />} />
        <Route path="guides/arbitrage-research" element={<ArbitrageResearchGuide />} />
        <Route path="guides/player-props" element={<PlayerPropsGuide />} />
        <Route path="guides/responsible-gambling" element={<ResponsibleGamblingGuide />} />
        <Route path="privacy" element={<Privacy />} />
        <Route path="terms" element={<Terms />} />
        <Route path="contact" element={<Contact />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="settings" element={<Settings />} />
        <Route path="alert" element={<Alert />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
