import React, { useState, useEffect } from 'react';
import { adminService, mlService } from '../services/api';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { useToast } from '../context/ToastContext';
import { Alert } from '../components/ui/Alert';
import { 
  Users, 
  Compass, 
  Share2, 
  AlertTriangle, 
  CheckCircle, 
  ShieldAlert, 
  Trash2, 
  MapPin, 
  Ban,
  Cpu,
  RefreshCw
} from 'lucide-react';


export const AdminDashboard: React.FC = () => {
  const { toast } = useToast();
  const [stats, setStats] = useState<any>(null);
  const [reports, setReports] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [mlMetrics, setMlMetrics] = useState<any>(null);
  const [trainingMl, setTrainingMl] = useState(false);

  const fetchAdminData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [statsData, reportsData, mlData] = await Promise.all([
        adminService.getStats(),
        adminService.getReports(),
        mlService.getMetrics()
      ]);
      setStats(statsData);
      setReports(reportsData);
      setMlMetrics(mlData);
    } catch (err: any) {
      console.error(err);
      setError('Forbidden: Only platform administrators can view this dashboard.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
  }, []);

  const handleTrainModel = async () => {
    setTrainingMl(true);
    try {
      const res = await mlService.trainModel();
      setMlMetrics(res.metrics || res);
      toast('ML matching classifier model successfully retrained!', 'success');
    } catch (error) {
      console.error(error);
      toast('Failed to train ML matching model.', 'error');
    } finally {
      setTrainingMl(false);
    }
  };


  const handleResolveReport = async (reportId: string) => {
    try {
      await adminService.resolveReport(reportId);
      toast('Report resolved successfully.', 'success');
      setReports(prev => prev.filter(r => r.id !== reportId));
      setStats((prev: any) => ({
        ...prev,
        reported_users_count: Math.max(0, prev.reported_users_count - 1)
      }));
    } catch (err) {
      toast('Failed to resolve report.', 'error');
    }
  };

  const handleSuspendUser = async (userId: string, reportId: string) => {
    try {
      await adminService.suspendUser(userId, true);
      await adminService.resolveReport(reportId);
      toast('User suspended and report resolved.', 'success');
      setReports(prev => prev.filter(r => r.id !== reportId));
    } catch (err) {
      toast('Failed to suspend user.', 'error');
    }
  };

  const handleDeleteTrip = async (tripId: string, reportId: string) => {
    try {
      await adminService.deleteInappropriateTrip(tripId);
      await adminService.resolveReport(reportId);
      toast('Flagged trip removed and report resolved.', 'success');
      setReports(prev => prev.filter(r => r.id !== reportId));
    } catch (err) {
      toast('Failed to delete trip.', 'error');
    }
  };

  if (error) {
    return (
      <div className="max-w-xl mx-auto py-12 text-left">
        <Alert variant="error" title="Access Restriction">
          {error}
        </Alert>
      </div>
    );
  }

  if (isLoading || !stats) {
    return (
      <div className="max-w-6xl mx-auto py-12 space-y-6 animate-pulse text-left">
        <div className="h-10 w-48 bg-slate-200 rounded-xl" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-28 bg-slate-200 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-6xl mx-auto text-left py-4">
      <div>
        <h1 className="text-3xl font-extrabold text-brand-950 font-display">Moderator Control Panel</h1>
        <p className="text-slate-500 font-semibold text-sm">Review platform metrics, manage traveler reports, and moderate content.</p>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
        <Card className="border-slate-200 shadow-sm">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="bg-brand-50 text-brand-600 p-3.5 rounded-2xl">
              <Users size={22} />
            </div>
            <div>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Registered Users</span>
              <p className="text-2xl font-extrabold text-brand-950">{stats.users_count}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="bg-teal-50 text-teal-600 p-3.5 rounded-2xl">
              <Compass size={22} />
            </div>
            <div>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Total Trips</span>
              <p className="text-2xl font-extrabold text-brand-950">{stats.trips_count}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="bg-emerald-50 text-emerald-600 p-3.5 rounded-2xl">
              <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Group Trips</span>
              <p className="text-2xl font-extrabold text-brand-950">{stats.group_trips_count || 0}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="bg-indigo-50 text-indigo-600 p-3.5 rounded-2xl">
              <Share2 size={22} />
            </div>
            <div>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Connections</span>
              <p className="text-2xl font-extrabold text-brand-950">{stats.connections_count}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="bg-cyan-50 text-cyan-600 p-3.5 rounded-2xl">
              <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Requests</span>
              <p className="text-2xl font-extrabold text-brand-950">{stats.requests_count || 0}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="bg-amber-50 text-amber-600 p-3.5 rounded-2xl">
              <AlertTriangle size={22} />
            </div>
            <div>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Pending Reports</span>
              <p className="text-2xl font-extrabold text-brand-950">{stats.reported_users_count + stats.reported_content_count}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ML Classifier Settings Dashboard */}
      <Card className="border border-brand-200 bg-brand-50/20 shadow-md">
        <CardHeader className="pb-2 border-b border-brand-100 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-extrabold text-brand-950 flex items-center gap-2">
            <Cpu size={18} className="text-brand-600" />
            <span>scikit-learn Match Classifier Settings (Admin Only)</span>
          </CardTitle>
          <Button 
            size="sm" 
            onClick={handleTrainModel} 
            isLoading={trainingMl} 
            className="gap-1.5"
          >
            <Cpu size={12} className={trainingMl ? 'animate-spin' : ''} />
            <span>Retrain Classifier</span>
          </Button>
        </CardHeader>
        <CardContent className="p-4 md:p-6 text-xs font-semibold">
          {mlMetrics ? (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="space-y-1 md:border-r md:border-brand-100 pr-2">
                <span className="text-slate-400 uppercase tracking-wider block text-[10px]">Model Type</span>
                <p className="text-sm font-bold text-brand-950">{mlMetrics.model_type || 'Logistic Regression'}</p>
                <span className="text-slate-400 block text-[9px] mt-1 font-medium">
                  Last Trained: {mlMetrics.trained_at ? new Date(mlMetrics.trained_at).toLocaleString() : 'N/A'}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-4 md:col-span-2 md:border-r md:border-brand-100 px-2">
                <div className="space-y-1">
                  <span className="text-slate-400 uppercase tracking-wider block text-[10px]">Accuracy</span>
                  <p className="text-base font-extrabold text-teal-600">{(mlMetrics.accuracy * 100).toFixed(1)}%</p>
                </div>
                <div className="space-y-1">
                  <span className="text-slate-400 uppercase tracking-wider block text-[10px]">F1-Score</span>
                  <p className="text-base font-extrabold text-teal-600">{(mlMetrics.f1_score * 100).toFixed(1)}%</p>
                </div>
                <div className="space-y-1">
                  <span className="text-slate-400 uppercase tracking-wider block text-[10px]">Precision</span>
                  <p className="text-sm font-bold text-slate-700">{(mlMetrics.precision * 100).toFixed(1)}%</p>
                </div>
                <div className="space-y-1">
                  <span className="text-slate-400 uppercase tracking-wider block text-[10px]">Recall</span>
                  <p className="text-sm font-bold text-slate-700">{(mlMetrics.recall * 100).toFixed(1)}%</p>
                </div>
              </div>
              <div className="space-y-1.5 pl-2">
                <span className="text-slate-400 uppercase tracking-wider block text-[10px]">Confusion Matrix</span>
                {mlMetrics.confusion_matrix ? (
                  <div className="font-mono bg-slate-900 text-slate-100 p-2.5 rounded-lg border border-slate-800 text-[10px] space-y-1 shadow-inner select-none pointer-events-none">
                    <div className="text-slate-400 pb-1 border-b border-slate-800 flex justify-between">
                      <span>Actual \ Pred</span>
                      <span>[0, 1]</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Rejected (0)</span>
                      <span>[{mlMetrics.confusion_matrix[0]?.[0] || 0}, {mlMetrics.confusion_matrix[0]?.[1] || 0}]</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Accepted (1)</span>
                      <span>[{mlMetrics.confusion_matrix[1]?.[0] || 0}, {mlMetrics.confusion_matrix[1]?.[1] || 0}]</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-slate-400">Not generated yet.</p>
                )}
              </div>
            </div>
          ) : (
            <p className="text-slate-500">Loading model performance metrics...</p>
          )}
        </CardContent>
      </Card>


      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Reports Moderation List */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-3 border-b border-slate-100 bg-slate-50/20">
              <CardTitle className="text-sm font-bold uppercase text-slate-450 tracking-wider flex items-center gap-2">
                <ShieldAlert size={16} className="text-amber-500" />
                <span>Pending Safety Reports</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {reports.filter(r => r.status === 'pending').length === 0 ? (
                <div className="p-12 text-center text-slate-400 text-xs font-semibold">
                  ✓ Excellent! No pending reports currently reviewable.
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {reports.filter(r => r.status === 'pending').map((report) => (
                    <div key={report.id} className="p-4 md:p-6 text-xs font-semibold space-y-3 text-left">
                      <div className="flex items-center justify-between">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          report.type === 'user' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'
                        }`}>
                          Reported: {report.type.toUpperCase()}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {new Date(report.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 bg-slate-55/40 p-3 rounded-xl border border-slate-150 text-[11px] text-slate-650">
                        <div>
                          <span className="text-[9px] uppercase tracking-wider text-slate-400 block font-bold">Reporter</span>
                          <span className="text-slate-800 font-bold">{report.reporter_name}</span> ({report.reporter_email})
                        </div>
                        <div>
                          <span className="text-[9px] uppercase tracking-wider text-slate-400 block font-bold">Flagged Target</span>
                          <span className="text-slate-800 font-bold">{report.reported_name}</span>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <span className="text-[9px] uppercase tracking-wider text-slate-400 block font-bold">Reason & Details</span>
                        <p className="text-slate-800 font-bold">"{report.reason}"</p>
                        {report.details && (
                          <p className="text-slate-500 font-medium italic mt-1 bg-white p-2 rounded border border-slate-100">
                            Details: {report.details}
                          </p>
                        )}
                      </div>

                      <div className="flex justify-end gap-2 pt-2">
                        <Button 
                          size="sm" 
                          variant="outline" 
                          onClick={() => handleResolveReport(report.id)}
                          className="gap-1.5 bg-white border-slate-300 text-slate-700"
                        >
                          <CheckCircle size={12} className="text-teal-600" />
                          <span>Dismiss</span>
                        </Button>

                        {report.type === 'user' ? (
                          <Button 
                            size="sm" 
                            variant="danger"
                            onClick={() => handleSuspendUser(report.reported_id, report.id)}
                            className="gap-1.5 font-bold"
                          >
                            <Ban size={12} />
                            <span>Suspend User</span>
                          </Button>
                        ) : (
                          <Button 
                            size="sm" 
                            variant="danger"
                            onClick={() => handleDeleteTrip(report.reported_id, report.id)}
                            className="gap-1.5 font-bold"
                          >
                            <Trash2 size={12} />
                            <span>Remove Content</span>
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Popular Destination Analytics */}
        <div className="lg:col-span-1">
          <Card className="border-slate-200 shadow-sm h-full">
            <CardHeader className="pb-3 border-b border-slate-100 bg-slate-50/20">
              <CardTitle className="text-sm font-bold uppercase text-slate-450 tracking-wider flex items-center gap-2">
                <MapPin size={16} className="text-brand-600" />
                <span>Trending Destinations</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-5 text-xs font-semibold">
              {stats.popular_destinations.map((dest: any, idx: number) => (
                <div key={idx} className="space-y-1.5 text-left">
                  <div className="flex justify-between font-bold text-slate-700">
                    <span>{dest.destination}</span>
                    <span className="text-brand-600">{dest.count} trips</span>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div 
                      className="bg-brand-500 h-full rounded-full transition-all duration-300"
                      style={{ width: `${Math.min(100, (dest.count / stats.trips_count) * 100) || (50 - idx * 15)}%` }}
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
