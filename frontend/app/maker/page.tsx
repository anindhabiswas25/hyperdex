'use client';

import Navbar from '@/components/Navbar';
import { useMakerState } from '@/hooks/useMakerState';

import LoadingScreen from '@/components/maker/LoadingScreen';
import ConnectPrompt from '@/components/maker/ConnectPrompt';
import ApplyForm from '@/components/maker/ApplyForm';
import PendingApprovalScreen from '@/components/maker/PendingApprovalScreen';
import RejectedScreen from '@/components/maker/RejectedScreen';
import SetupStepTracker from '@/components/maker/SetupStepTracker';
import MakerDashboard from '@/components/maker/MakerDashboard';

export default function MakerPage() {
  const { state, loading, applicationData, inventoryData, makerData, refetch } = useMakerState();

  if (loading) {
    return (
      <>
        <Navbar />
        <LoadingScreen message="Checking your maker status..." />
      </>
    );
  }

  const renderContent = () => {
    switch (state) {

      case 'disconnected':
        return <ConnectPrompt />;

      case 'not_applied':
        return (
          <div className="max-w-2xl mx-auto px-6 pt-16 pb-16">
            <ApplyForm onSuccess={refetch} />
          </div>
        );

      case 'pending_approval':
        return (
          <div className="max-w-2xl mx-auto px-6 pt-16 pb-16">
            <PendingApprovalScreen application={applicationData} onStatusChange={refetch} />
          </div>
        );

      case 'rejected':
        return <RejectedScreen application={applicationData} onReapply={refetch} />;

      case 'approved_sdk_pending':
      case 'approved_pool_pending':
      case 'approved_onchain_pending':
        return (
          <div className="max-w-2xl mx-auto px-6 pt-16 pb-16">
            <SetupStepTracker
              state={state}
              application={applicationData}
              makerData={makerData}
              onStepComplete={refetch}
            />
          </div>
        );

      case 'active':
        return (
          <MakerDashboard inventoryData={inventoryData} onRefresh={refetch} />
        );

      default:
        return <ConnectPrompt />;
    }
  };

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-cream" style={{ paddingTop: '72px' }}>
        {renderContent()}
      </main>
    </>
  );
}
