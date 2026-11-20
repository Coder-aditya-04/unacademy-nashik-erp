import React, { useState, useEffect, lazy, Suspense } from 'react';
import { HashRouter, Routes, Route, Link, Navigate } from 'react-router-dom';
import { getAuth, onAuthStateChanged, signOut } from 'firebase/auth';
import { getFirestore, doc, getDoc } from 'firebase/firestore'; // New imports
import { monitorSession } from './services/sessionService'; // Import Session Monitor

// Pages
import PublicHome from './pages/PublicHome';
const CounsellorDashboard = lazy(() => import('./pages/CounsellorDashboard'));
const FrontDeskDashboard = lazy(() => import('./pages/FrontDeskDashboard'));
const MainCalculator = lazy(() => import('./pages/MainCalculator'));
const TokenCalculator = lazy(() => import('./pages/TokenCalculator'));
const DirectorDashboard = lazy(() => import('./pages/DirectorDashboard'));
// Import
const CollegeTieUps = lazy(() => import('./modules/accounts/pages/CollegeTieUps'));
const FeeStructureManager = lazy(() => import('./modules/accounts/pages/FeeStructureManager'));
const AccountantDashboard = lazy(() => import('./modules/accounts/pages/AccountantDashboard'));
const LeadsHome = lazy(() => import('./modules/crm/LeadsHome'));
const LeadDetails = lazy(() => import('./modules/crm/pages/LeadDetails'));
import Login from './pages/Login';
const RegisterDetails = lazy(() => import('./pages/RegisterDetails'));
const PendingApproval = lazy(() => import('./pages/PendingApproval'));
const BatchManager = lazy(() => import('./modules/admin/pages/BatchManager'));
const BatchDetails = lazy(() => import('./modules/admin/pages/BatchDetails'));
const StudentRecords = lazy(() => import('./pages/StudentRecords'));
const UserProfile = lazy(() => import('./pages/UserProfile'));
const MyDayPage = lazy(() => import('./modules/myday/MyDayPage'));
const StudentProfile = lazy(() => import('./modules/students/StudentProfile'));


const FinalizeAdmission = lazy(() => import('./modules/accounts/pages/FinalizeAdmission'));
const TakeAdmission = lazy(() => import('./modules/crm/components/AdmissionForm'));
const MyAdmissions = lazy(() => import('./modules/crm/components/MyAdmissions'));
const FeeRecovery = lazy(() => import('./modules/accounts/pages/FeeRecovery'));
const RecoveryDashboard = lazy(() => import('./modules/recovery/pages/RecoveryDashboard'));

// Config
import { CENTERS } from './utils/centers';
import { MoneyVisibilityProvider } from './components/Money';
import { AcademicYearProvider } from './components/AcademicYear';
import StaffShell from './components/shell/StaffShell';

// Wrapper for Internal Staff Pages
const StaffLayout = ({ children, user, userProfile, handleLogout, currentCenter, setCurrentCenter }) => {
  // SECURITY FIX: Explicitly handle unauthenticated state to prevent unauthorized access
  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gray-50">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-red-600 mb-2">Access Denied</h2>
          <p className="text-gray-600 mb-6">Please log in to access the portal.</p>
          <Navigate to="/login" replace />
          <Link to="/login" className="text-blue-600 hover:underline">Go to Login Page</Link>
        </div>
      </div>
    );
  }

  // SECURITY FIX: Redirect users with deleted profiles or who need registration to register-details
  if (!userProfile) {
    return <Navigate to="/register-details" replace />;
  }

  // SECURITY FIX: Redirect unverified/pending accounts to pending-approval page
  if (userProfile.verified === false) {
    return <Navigate to="/pending-approval" replace />;
  }

  const role = userProfile?.role?.toUpperCase();
  const isDirector = role === 'DIRECTOR';

  return (
    <AcademicYearProvider key={role} canPick={isDirector || role === 'MANAGER' || role === 'ACCOUNTANT'}>
      <StaffShell userProfile={userProfile} handleLogout={handleLogout} currentCenter={currentCenter} setCurrentCenter={setCurrentCenter}>
        <MoneyVisibilityProvider maskable={isDirector}>
          {children}
        </MoneyVisibilityProvider>
      </StaffShell>
    </AcademicYearProvider>
  );
};

function App() {
  const auth = getAuth();
  const db = getFirestore();
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentCenter, setCurrentCenter] = useState(CENTERS.UN_COLLEGE); // Default center

  useEffect(() => {
    // Old builds could store a hand-made profile in the browser that skipped
    // the approval checks. Profiles now come only from Firestore.
    try { localStorage.removeItem("user_profile_override"); } catch { /* storage blocked */ }

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        const userDocRef = doc(db, 'users', currentUser.uid);
        const docSnap = await getDoc(userDocRef);
        if (docSnap.exists()) {
          const dbProfile = docSnap.data();
          let profile = dbProfile;


          // CRITICAL FIX: Inject the UID into the profile object so it can be used for queries
          setUserProfile({ ...profile, uid: currentUser.uid, id: currentUser.uid });

          // Set current center based on user's assigned center, or default
          let assignedCenterId = profile.centerId || profile.CenterId || "";

          // Normalize
          assignedCenterId = assignedCenterId.trim().toUpperCase();

          // Handle Alias / Typo Fixes
          if (assignedCenterId === "PRAYAAS" || assignedCenterId === "PRAYAS_EDU") {
            assignedCenterId = "PRAYAS";
          }

          if (assignedCenterId && CENTERS[assignedCenterId]) {
            setCurrentCenter(CENTERS[assignedCenterId]);
          } else {
            console.warn(`Center ID '${assignedCenterId}' not found in configuration. Defaulting to College Rd.`);
            setCurrentCenter(CENTERS.UN_COLLEGE); // Fallback to a default center
          }
        } else {

          setUserProfile(null);
          setCurrentCenter(CENTERS.UN_COLLEGE); // Fallback if no profile
        }
      } else {
        setUser(null);
        setUserProfile(null);
        setCurrentCenter(CENTERS.UN_COLLEGE); // Reset center on logout
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [auth, db]);

  // NEW: Session Monitor Effect
  // NEW: Session Monitor Effect
  useEffect(() => {
    let unsubscribeSession = () => { };
    if (user) {
      // 0. RACE CONDITION FIX: If we are on the login page, DO NOT checking for session yet.
      // Give Login.jsx time to register the session.
      if (window.location.hash.includes('login')) {
        return;
      }

      // 1. Force Logout if this is a "Legacy" session (pre-tracking update)
      const currentSessionId = localStorage.getItem('current_session_id');
      if (!currentSessionId) {
        console.warn("Legacy session detected. Forcing re-login to track device.");
        signOut(auth).then(() => {
          setUser(null);
          // Only reload if we are NOT on login page preventing loops
          if (!window.location.hash.includes('login')) {
            window.location.reload();
          }
        });
        return;
      }

      // 2. Monitor Active Session
      unsubscribeSession = monitorSession(user.uid, () => {
        alert("Your session has been terminated from another device.");
        signOut(auth).then(() => {
          setUser(null);
          setUserProfile(null);
          window.location.href = '/#/login';
        });
      });
    }
    return () => unsubscribeSession();
  }, [user, auth]);

  const handleLogout = () => {
    signOut(auth).then(() => {
      // Sign-out successful.
      setUser(null);
      setUserProfile(null);
      setCurrentCenter(CENTERS.UN_COLLEGE); // Reset center on logout
      console.log("User signed out");
    }).catch((error) => {
      // An error happened.
      console.error("Error signing out:", error);
    });
  };




  if (loading) return <div className="h-screen flex items-center justify-center">Loading KAP System...</div>;

  return (
    <HashRouter>
      {/* Staff pages load on demand, so the public site downloads only what it shows. */}
      <Suspense fallback={<div className="h-screen flex items-center justify-center">Loading...</div>}>
      <Routes>
        <Route path="/" element={<PublicHome />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register-details" element={<RegisterDetails />} />
        <Route path="/pending-approval" element={<PendingApproval />} />

        {/* PROTECTED ROUTES */}
        <Route path="/staff/dashboard" element={
          <StaffLayout user={user} userProfile={userProfile} handleLogout={handleLogout} currentCenter={currentCenter} setCurrentCenter={setCurrentCenter}>

            {(userProfile?.role?.toUpperCase() === 'DIRECTOR' || userProfile?.role?.toUpperCase() === 'MANAGER') ? (
              <DirectorDashboard center={currentCenter} isManager={userProfile?.role?.toUpperCase() === 'MANAGER'} userProfile={userProfile} />
            ) : (userProfile?.role?.toUpperCase() === 'ACCOUNTANT') ? (
              <AccountantDashboard userProfile={userProfile} />
            ) : (userProfile?.role?.toUpperCase() === 'FRONT_DESK') ? (
              // Explicit Redirection for Front Desk to prevent unauthorized access to Counsellor Dashboard logic
              <Navigate to="/staff/front-desk" replace />
            ) : (userProfile?.role?.toUpperCase() === 'BDE') ? (
              <Navigate to="/staff/leads" replace />
            ) : (userProfile?.role?.toUpperCase() === 'RECOVERY') ? (
              <RecoveryDashboard userProfile={userProfile} />
            ) : (
              <CounsellorDashboard userProfile={userProfile} center={currentCenter} />
            )}
          </StaffLayout>
        } />

        {/* Recovery Desk for the Director (all centres) and Managers (own centre) */}
        <Route path="/staff/recovery-desk" element={
          <StaffLayout user={user} userProfile={userProfile} handleLogout={handleLogout} currentCenter={currentCenter} setCurrentCenter={setCurrentCenter}>
            {['DIRECTOR', 'MANAGER', 'RECOVERY'].includes(userProfile?.role?.toUpperCase()) ? <RecoveryDashboard userProfile={userProfile} /> : <div className="text-center p-10 text-red-500">Access Denied</div>}
          </StaffLayout>
        } />

        {/* NEW FRONT DESK DASHBOARD */}
        <Route path="/staff/front-desk" element={
          <StaffLayout user={user} userProfile={userProfile} handleLogout={handleLogout} currentCenter={currentCenter} setCurrentCenter={setCurrentCenter}>
            {(userProfile?.role?.toUpperCase() === 'FRONT_DESK' || userProfile?.role?.toUpperCase() === 'DIRECTOR' || userProfile?.role?.toUpperCase() === 'MANAGER') ? (
              <FrontDeskDashboard userProfile={userProfile} center={currentCenter} />
            ) : (
              <div className="text-center p-10 text-red-500 font-bold">Access Denied: Front Desk Only</div>
            )}
          </StaffLayout>
        } />

        <Route path="/staff/calculator" element={
          <StaffLayout user={user} userProfile={userProfile} handleLogout={handleLogout} currentCenter={currentCenter} setCurrentCenter={setCurrentCenter}>
            <MainCalculator center={currentCenter} userProfile={userProfile} />
          </StaffLayout>
        } />

        <Route path="/staff/token" element={
          <StaffLayout user={user} userProfile={userProfile} handleLogout={handleLogout} currentCenter={currentCenter} setCurrentCenter={setCurrentCenter}>
            <TokenCalculator center={currentCenter} userProfile={userProfile} />
          </StaffLayout>
        } />



        {/* CRM Route */}
        <Route path="/staff/leads" element={
          <StaffLayout user={user} userProfile={userProfile} handleLogout={handleLogout} currentCenter={currentCenter} setCurrentCenter={setCurrentCenter}>
            {/* HIDE CRM FROM FRONT DESK */}
            {userProfile?.role === 'FRONT_DESK' ? <div className="text-center p-10 text-slate-400">Access Restricted</div> : <LeadsHome userProfile={userProfile} />}
          </StaffLayout>
        } />

        <Route path="/staff/leads/:id" element={
          <StaffLayout user={user} userProfile={userProfile} handleLogout={handleLogout} currentCenter={currentCenter} setCurrentCenter={setCurrentCenter}>
            {userProfile?.role === 'FRONT_DESK' ? <div className="text-center p-10 text-slate-400">Access Restricted</div> : <LeadDetails userProfile={userProfile} />}
          </StaffLayout>
        } />

        {/* Director Only Route */}
        <Route path="/staff/admin" element={
          <StaffLayout user={user} userProfile={userProfile} handleLogout={handleLogout} currentCenter={currentCenter} setCurrentCenter={setCurrentCenter}>
            {userProfile?.role === 'DIRECTOR' ? <DirectorDashboard center={currentCenter} userProfile={userProfile} /> : <div className="text-center p-10 text-red-500">Access Denied</div>}
          </StaffLayout>
        } />

        <Route path="/staff/batches" element={
          <StaffLayout user={user} userProfile={userProfile} handleLogout={handleLogout} currentCenter={currentCenter} setCurrentCenter={setCurrentCenter}>
            {(userProfile?.role === 'DIRECTOR' || userProfile?.role === 'MANAGER') ? <BatchManager userProfile={userProfile} /> : <div className="text-center p-10 text-red-500">Access Denied</div>}
          </StaffLayout>
        } />

        <Route path="/staff/batches/:id" element={
          <StaffLayout user={user} userProfile={userProfile} handleLogout={handleLogout} currentCenter={currentCenter} setCurrentCenter={setCurrentCenter}>
            {(userProfile?.role === 'DIRECTOR' || userProfile?.role === 'MANAGER') ? <BatchDetails /> : <div className="text-center p-10 text-red-500">Access Denied</div>}
          </StaffLayout>
        } />

        <Route path="/staff/accounts" element={
          <StaffLayout user={user} userProfile={userProfile} handleLogout={handleLogout} currentCenter={currentCenter} setCurrentCenter={setCurrentCenter}>
            {(userProfile?.role === 'ACCOUNTANT' || userProfile?.role === 'DIRECTOR') ? <AccountantDashboard userProfile={userProfile} /> : <div className="text-center p-10 text-red-500">Access Denied</div>}
          </StaffLayout>
        } />

        <Route path="/staff/recovery" element={
          <StaffLayout user={user} userProfile={userProfile} handleLogout={handleLogout} currentCenter={currentCenter} setCurrentCenter={setCurrentCenter}>
            {(userProfile?.role === 'ACCOUNTANT' || userProfile?.role === 'DIRECTOR' || userProfile?.role === 'MANAGER') ? <FeeRecovery userProfile={userProfile} /> : <div className="text-center p-10 text-red-500">Access Denied</div>}
          </StaffLayout>
        } />

        <Route path="/staff/tie-ups" element={
          <StaffLayout user={user} userProfile={userProfile} handleLogout={handleLogout} currentCenter={currentCenter} setCurrentCenter={setCurrentCenter}>
            {(userProfile?.role === 'ACCOUNTANT' || userProfile?.role === 'DIRECTOR') ? <CollegeTieUps userProfile={userProfile} /> : <div className="text-center p-10 text-red-500">Access Denied</div>}
          </StaffLayout>
        } />

        <Route path="/staff/fees" element={
          <StaffLayout user={user} userProfile={userProfile} handleLogout={handleLogout} currentCenter={currentCenter} setCurrentCenter={setCurrentCenter}>
            {(userProfile?.role === 'ACCOUNTANT' || userProfile?.role === 'DIRECTOR') ? <FeeStructureManager /> : <div className="text-center p-10 text-red-500">Access Denied</div>}
          </StaffLayout>
        } />

        <Route path="/staff/admission/:id" element={
          <StaffLayout user={user} userProfile={userProfile} handleLogout={handleLogout} currentCenter={currentCenter} setCurrentCenter={setCurrentCenter}>
            <FinalizeAdmission userProfile={userProfile} />
          </StaffLayout>
        } />

        <Route path="/staff/take-admission" element={
          <StaffLayout user={user} userProfile={userProfile} handleLogout={handleLogout} currentCenter={currentCenter} setCurrentCenter={setCurrentCenter}>
            <TakeAdmission userProfile={userProfile} currentCenter={currentCenter} />
          </StaffLayout>
        } />

        <Route path="/staff/my-admissions" element={
          <StaffLayout user={user} userProfile={userProfile} handleLogout={handleLogout} currentCenter={currentCenter} setCurrentCenter={setCurrentCenter}>
            <MyAdmissions userProfile={userProfile} />
          </StaffLayout>
        } />

        <Route path="/staff/student-records" element={
          <StaffLayout user={user} userProfile={userProfile} handleLogout={handleLogout} currentCenter={currentCenter} setCurrentCenter={setCurrentCenter}>
            {(userProfile?.role === 'DIRECTOR' || userProfile?.role === 'MANAGER') ?
              <StudentRecords center={currentCenter} isManager={userProfile?.role === 'MANAGER'} userProfile={userProfile} />
              : <div className="text-center p-10 text-red-500">Access Denied</div>}
          </StaffLayout>
        } />

        <Route path="/staff/my-day" element={
          <StaffLayout user={user} userProfile={userProfile} handleLogout={handleLogout} currentCenter={currentCenter} setCurrentCenter={setCurrentCenter}>
            <MyDayPage userProfile={userProfile} />
          </StaffLayout>
        } />

        <Route path="/staff/student/:id" element={
          <StaffLayout user={user} userProfile={userProfile} handleLogout={handleLogout} currentCenter={currentCenter} setCurrentCenter={setCurrentCenter}>
            <StudentProfile userProfile={userProfile} />
          </StaffLayout>
        } />

        <Route path="/staff/profile" element={
          <StaffLayout user={user} userProfile={userProfile} handleLogout={handleLogout} currentCenter={currentCenter} setCurrentCenter={setCurrentCenter}>
            <UserProfile userProfile={userProfile} />
          </StaffLayout>
        } />

        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
      </Suspense>
    </HashRouter>
  );
}

export default App;
