const ACTIVE_PROJECT_KEY = 'construction_active_project_id';
const ACTIVE_COMPANY_KEY = 'construction_active_company_id';

type Listener = () => void;

class ActiveProjectStore {
  private projectId: string =
    typeof window !== 'undefined' ? localStorage.getItem(ACTIVE_PROJECT_KEY) || '' : '';
  private companyId: string =
    typeof window !== 'undefined' ? localStorage.getItem(ACTIVE_COMPANY_KEY) || '' : '';
  private listeners = new Set<Listener>();

  getProjectId(): string {
    return this.projectId;
  }

  setProjectId(id: string) {
    this.projectId = id;
    if (typeof window !== 'undefined') {
      if (id) {
        localStorage.setItem(ACTIVE_PROJECT_KEY, id);
      } else {
        localStorage.removeItem(ACTIVE_PROJECT_KEY);
      }
    }
    this.listeners.forEach((l) => l());
  }

  getCompanyId(): string {
    return this.companyId;
  }

  setCompanyId(id: string) {
    this.companyId = id;
    if (typeof window !== 'undefined') {
      if (id) {
        localStorage.setItem(ACTIVE_COMPANY_KEY, id);
      } else {
        localStorage.removeItem(ACTIVE_COMPANY_KEY);
      }
    }
    this.listeners.forEach((l) => l());
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}

export const activeProjectStore = new ActiveProjectStore();
