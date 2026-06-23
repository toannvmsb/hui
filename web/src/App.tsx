import { useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './store/auth';
import { PhoneFrame } from './components/Layout';
import { Spinner } from './components/ui';
import { EkycPromptSheet } from './components/EkycGate';

// Onboarding
import Welcome from './pages/Welcome';
import Login from './pages/Login';
import Otp from './pages/Otp';
import Ekyc from './pages/Ekyc';
import VerifySuccess from './pages/VerifySuccess';
// Player
import Home from './pages/Home';
import GroupList from './pages/GroupList';
import GroupDetail from './pages/GroupDetail';
import GroupCreate from './pages/GroupCreate';
import GroupSign from './pages/GroupSign';
import Contribute from './pages/Contribute';
import Auction from './pages/Auction';
import Discover from './pages/Discover';
import JoinGroup from './pages/JoinGroup';
import Wallet from './pages/Wallet';
import WalletAction from './pages/WalletAction';
import BankLinks from './pages/BankLinks';
import History from './pages/History';
import Slots from './pages/Slots';
import SlotDetail from './pages/SlotDetail';
import SlotTransfer from './pages/SlotTransfer';
import Transfers from './pages/Transfers';
import Profile from './pages/Profile';
import Notifications from './pages/Notifications';
import Alerts from './pages/Alerts';
import Disputes from './pages/Disputes';
import DisputeNew from './pages/DisputeNew';
import Support from './pages/Support';
import Evidence from './pages/Evidence';
import Guarantee from './pages/Guarantee';
// Organizer & Admin
import OrganizerHome from './pages/OrganizerHome';
import OrganizerGroup from './pages/OrganizerGroup';
import AdminHome from './pages/AdminHome';
import AdminReconcile from './pages/AdminReconcile';
import AdminDisputes from './pages/AdminDisputes';
import AdminRisk from './pages/AdminRisk';
import AdminRiskDetail from './pages/AdminRiskDetail';
import AdminAnalytics from './pages/AdminAnalytics';
import AdminUsers from './pages/AdminUsers';
import AdminUserDetail from './pages/AdminUserDetail';
import AdminGroups from './pages/AdminGroups';
import AdminApprovals from './pages/AdminApprovals';
import AdminScoreConfig from './pages/AdminScoreConfig';
import AdminReports from './pages/AdminReports';
import AdminReportView from './pages/AdminReportView';
import AdminEkyc from './pages/AdminEkyc';
import AdminEkycDetail from './pages/AdminEkycDetail';

function Protected({ children }: { children: JSX.Element }) {
  const { me, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <PhoneFrame><Spinner label="Đang tải..." /></PhoneFrame>;
  if (!me) return <Navigate to="/welcome" replace state={{ from: loc }} />;
  return children;
}

export default function App() {
  const fetchMe = useAuth((s) => s.fetchMe);
  useEffect(() => { fetchMe(); }, [fetchMe]);

  return (
    <PhoneFrame>
      <Routes>
        <Route path="/welcome" element={<Welcome />} />
        <Route path="/login" element={<Login />} />
        <Route path="/otp" element={<Otp />} />
        <Route path="/ekyc" element={<Protected><Ekyc /></Protected>} />
        <Route path="/verify-success" element={<Protected><VerifySuccess /></Protected>} />

        <Route path="/" element={<Protected><Home /></Protected>} />
        <Route path="/groups" element={<Protected><GroupList /></Protected>} />
        <Route path="/groups/new" element={<Protected><GroupCreate /></Protected>} />
        <Route path="/groups/:id" element={<Protected><GroupDetail /></Protected>} />
        <Route path="/groups/:id/sign" element={<Protected><GroupSign /></Protected>} />
        <Route path="/groups/:id/contribute" element={<Protected><Contribute /></Protected>} />
        <Route path="/cycles/:cycleId/auction" element={<Protected><Auction /></Protected>} />
        <Route path="/discover" element={<Protected><Discover /></Protected>} />
        <Route path="/join/:code" element={<Protected><JoinGroup /></Protected>} />

        <Route path="/wallet" element={<Protected><Wallet /></Protected>} />
        <Route path="/wallet/:action" element={<Protected><WalletAction /></Protected>} />
        <Route path="/banks" element={<Protected><BankLinks /></Protected>} />
        <Route path="/history" element={<Protected><History /></Protected>} />

        <Route path="/slots" element={<Protected><Slots /></Protected>} />
        <Route path="/slots/:id" element={<Protected><SlotDetail /></Protected>} />
        <Route path="/slots/:id/transfer" element={<Protected><SlotTransfer /></Protected>} />
        <Route path="/transfers" element={<Protected><Transfers /></Protected>} />

        <Route path="/profile" element={<Protected><Profile /></Protected>} />
        <Route path="/notifications" element={<Protected><Notifications /></Protected>} />
        <Route path="/alerts" element={<Protected><Alerts /></Protected>} />
        <Route path="/disputes" element={<Protected><Disputes /></Protected>} />
        <Route path="/disputes/new" element={<Protected><DisputeNew /></Protected>} />
        <Route path="/support" element={<Protected><Support /></Protected>} />
        <Route path="/evidence/:groupId" element={<Protected><Evidence /></Protected>} />
        <Route path="/guarantee" element={<Protected><Guarantee /></Protected>} />

        <Route path="/organizer" element={<Protected><OrganizerHome /></Protected>} />
        <Route path="/organizer/groups/:id" element={<Protected><OrganizerGroup /></Protected>} />

        <Route path="/admin" element={<Protected><AdminHome /></Protected>} />
        <Route path="/admin/reconcile" element={<Protected><AdminReconcile /></Protected>} />
        <Route path="/admin/disputes" element={<Protected><AdminDisputes /></Protected>} />
        <Route path="/admin/risk" element={<Protected><AdminRisk /></Protected>} />
        <Route path="/admin/risk/:id" element={<Protected><AdminRiskDetail /></Protected>} />
        <Route path="/admin/analytics" element={<Protected><AdminAnalytics /></Protected>} />
        <Route path="/admin/users" element={<Protected><AdminUsers /></Protected>} />
        <Route path="/admin/users/:id" element={<Protected><AdminUserDetail /></Protected>} />
        <Route path="/admin/groups" element={<Protected><AdminGroups /></Protected>} />
        <Route path="/admin/approvals" element={<Protected><AdminApprovals /></Protected>} />
        <Route path="/admin/score-config" element={<Protected><AdminScoreConfig /></Protected>} />
        <Route path="/admin/reports" element={<Protected><AdminReports /></Protected>} />
        <Route path="/admin/reports/:type" element={<Protected><AdminReportView /></Protected>} />
        <Route path="/admin/ekyc" element={<Protected><AdminEkyc /></Protected>} />
        <Route path="/admin/ekyc/:id" element={<Protected><AdminEkycDetail /></Protected>} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <EkycPromptSheet />
    </PhoneFrame>
  );
}
