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
import Faq from "./pages/Faq.jsx";
import Glossary from "./pages/Glossary.jsx";
import MoneylineSpreadsGuide from "./pages/guides/MoneylineSpreadsGuide.jsx";
import LineMovementGuide from "./pages/guides/LineMovementGuide.jsx";
import ResearchEthicsGuide from "./pages/guides/ResearchEthicsGuide.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Settings from "./pages/Settings.jsx";
import Alert from "./pages/Alert.jsx";
import ProjectAuth from "./pages/ProjectAuth.jsx";
import ProjectInvite from "./pages/ProjectInvite.jsx";
import { DEFAULT_PROJECT_SLUG } from "./lib/auth.jsx";

export default function App() {
  return (
    <Routes>
      <Route element={<SiteLayout />}>
        <Route index element={<Home />} />
        <Route path="p/:slug/auth" element={<ProjectAuth />} />
        <Route path="p/:slug/invite/:token" element={<ProjectInvite />} />
        <Route path="about" element={<About />} />
        <Route path="how-it-works" element={<HowItWorks />} />
        <Route path="guides" element={<Guides />} />
        <Route path="guides/odds-formats" element={<OddsFormatsGuide />} />
        <Route path="guides/implied-probability" element={<ImpliedProbabilityGuide />} />
        <Route path="guides/arbitrage-research" element={<ArbitrageResearchGuide />} />
        <Route path="guides/player-props" element={<PlayerPropsGuide />} />
        <Route path="guides/responsible-gambling" element={<ResponsibleGamblingGuide />} />
        <Route path="guides/moneyline-and-spreads" element={<MoneylineSpreadsGuide />} />
        <Route path="guides/line-movement" element={<LineMovementGuide />} />
        <Route path="guides/research-ethics" element={<ResearchEthicsGuide />} />
        <Route path="faq" element={<Faq />} />
        <Route path="glossary" element={<Glossary />} />
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
