import React, { useState } from 'react';
import { Weather } from '@construction/shared';
import {
  getSyncStateLabel,
  LocalReportRecord,
  LocalSqliteRepository,
} from '../db/sqlite-repository';
import { SyncWorker } from '../services/sync-worker';

export interface MobileAppProps {
  repo: LocalSqliteRepository;
  syncWorker: SyncWorker;
  user: { id: string; name: string; email: string; role: string } | null;
  onLogin: (email: string, password: string) => Promise<void>;
  onLogout: () => Promise<void>;
}

// Implements all 6 mobile screens from design/mockups/mobile.html & Spec 01 T19 / Spec 03 T08, T11:
// 1. Login, 2. My projects, 3. Project home (no prices!), 4. New daily report, 5. Report detail, 6. Pending uploads + Profile
export const MobileAppContainer: React.FC<MobileAppProps> = ({
  repo,
  syncWorker,
  user,
  onLogin,
  onLogout,
}) => {
  const [screen, setScreen] = useState<
    'projects' | 'project_home' | 'report_form' | 'report_detail' | 'pending_uploads' | 'profile'
  >('projects');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [selectedReport, setSelectedReport] = useState<LocalReportRecord | null>(null);
  const [email, setEmail] = useState('kumar@example.com');
  const [password, setPassword] = useState('');
  const [reportDate, setReportDate] = useState(new Date().toISOString().slice(0, 10));
  const [weather, setWeather] = useState<Weather>('CLOUDY');
  const [workDone, setWorkDone] = useState('');
  const [issues, setIssues] = useState('');
  const [nextDayPlan, setNextDayPlan] = useState('');
  const [, setTick] = useState(0);

  const refreshUi = () => setTick((t) => t + 1);

  if (!user) {
    return (
      <div className="phone-screen">
        <h1>Contoh Bina</h1>
        <p>Site reports</p>
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
        />
        <button onClick={() => onLogin(email, password)}>Log in</button>
      </div>
    );
  }

  const projects = repo.getCachedProjects();
  const pendingList = repo.getPendingOrFailedReports();
  const currentProject = projects.find((p) => p.id === selectedProjectId) || projects[0];

  if (screen === 'profile') {
    return (
      <div className="phone-screen">
        <h2>Profile</h2>
        <p>{user.name}</p>
        <p>{user.email}</p>
        <p>Role: {user.role}</p>
        <button onClick={() => setScreen('projects')}>Back to projects</button>
        <button onClick={onLogout}>Log out</button>
      </div>
    );
  }

  if (screen === 'pending_uploads') {
    return (
      <div className="phone-screen">
        <h2>Pending uploads ({pendingList.length})</h2>
        {pendingList.map((r) => (
          <div key={r.id}>
            <b>{r.reportDate}</b> - <span>{getSyncStateLabel(r.syncState)}</span>
            {r.lastError && <p>{r.lastError}</p>}
            {r.syncState === 'FAILED' && (
              <button
                onClick={() => {
                  syncWorker.retryFailedReport(r.id);
                  syncWorker.runSync().then(refreshUi);
                }}
              >
                Retry
              </button>
            )}
          </div>
        ))}
        <button onClick={() => syncWorker.runSync().then(refreshUi)}>Upload now</button>
        <button onClick={() => setScreen('projects')}>Back</button>
      </div>
    );
  }

  if (screen === 'report_form' && currentProject) {
    return (
      <div className="phone-screen">
        <h2>Daily report - {currentProject.name}</h2>
        <input
          value={reportDate}
          onChange={(e) => setReportDate(e.target.value)}
          placeholder="YYYY-MM-DD"
        />
        <div>
          {(['SUNNY', 'CLOUDY', 'RAIN', 'HEAVY_RAIN'] as Weather[]).map((w) => (
            <button key={w} onClick={() => setWeather(w)}>
              {w}
            </button>
          ))}
        </div>
        <textarea
          value={workDone}
          onChange={(e) => {
            setWorkDone(e.target.value);
            repo.saveDraft(
              {
                projectId: currentProject.id,
                reportDate,
                weather,
                workDone: e.target.value,
                issues,
                nextDayPlan,
                deviceCreatedAt: new Date().toISOString(),
                manpower: repo
                  .getRecentTradesForProject(currentProject.id)
                  .map((trade) => ({ trade, headcount: 4 })),
              },
              [{ localUri: 'file://site-photo-1.jpg', caption: 'Site progress' }],
            );
          }}
        />
        <textarea
          value={issues}
          onChange={(e) => setIssues(e.target.value)}
          placeholder="Issues or delays"
        />
        <textarea
          value={nextDayPlan}
          onChange={(e) => setNextDayPlan(e.target.value)}
          placeholder="Plan for tomorrow"
        />
        <button
          onClick={() => {
            const saved = repo.saveDraft(
              {
                projectId: currentProject.id,
                reportDate,
                weather,
                workDone,
                issues,
                nextDayPlan,
                deviceCreatedAt: new Date().toISOString(),
                manpower: [{ trade: 'Carpenter', headcount: 4 }],
              },
              [{ localUri: 'file://site-photo-1.jpg', caption: 'Site progress' }],
            );
            repo.queueForSync(saved.report.id);
            syncWorker.runSync().then(refreshUi);
            setScreen('project_home');
          }}
        >
          Submit report
        </button>
      </div>
    );
  }

  if (screen === 'report_detail' && selectedReport) {
    return (
      <div className="phone-screen">
        <h2>{selectedReport.reportDate}</h2>
        <span>{getSyncStateLabel(selectedReport.syncState)}</span>
        <p>{selectedReport.payload.workDone}</p>
        <button onClick={() => setScreen('project_home')}>Back</button>
      </div>
    );
  }

  if (screen === 'project_home' && currentProject) {
    const reports = repo.listReportsByProject(currentProject.id);
    return (
      <div className="phone-screen">
        <h2>{currentProject.name}</h2>
        <p>
          {currentProject.code} · {currentProject.siteAddress || ''}
        </p>
        <button onClick={() => setScreen('report_form')}>New daily report</button>
        <h3>Recent reports</h3>
        {reports.map((r) => (
          <div
            key={r.id}
            onClick={() => {
              setSelectedReport(r);
              setScreen('report_detail');
            }}
          >
            <span>{r.reportDate}</span> - <span>{getSyncStateLabel(r.syncState)}</span>
          </div>
        ))}
        <button onClick={() => setScreen('projects')}>Back to projects</button>
      </div>
    );
  }

  return (
    <div className="phone-screen">
      <div className="bar-top">
        <span>My projects</span>
        <button onClick={() => setScreen('profile')}>{user.name}</button>
      </div>
      {pendingList.length > 0 && (
        <div className="banner" onClick={() => setScreen('pending_uploads')}>
          {pendingList.length} report(s) waiting to upload
        </div>
      )}
      {projects.map((p) => (
        <div
          key={p.id}
          onClick={() => {
            setSelectedProjectId(p.id);
            setScreen('project_home');
          }}
        >
          <b>{p.name}</b>
          <div>
            {p.code} · {p.siteAddress || ''}
          </div>
        </div>
      ))}
    </div>
  );
};
