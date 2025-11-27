export type DeadlineType = 'HW' | 'Quiz' | 'Project' | 'Exam' | 'Other';

export type DeadlineSource = 'Activity' | 'Calendar' | 'Assignment' | 'Announcement' | 'Manual' | 'Gradescope';

export interface DeadlineItem {
  id: string;
  course: string;
  courseCode?: string;
  title: string;
  type: DeadlineType;
  due_at_iso: string;
  source_url: string;
  raw_text: string;
  confidence: number;
  source: DeadlineSource;
  updated: boolean;
  sequence: number;
  confirmed: boolean;
  missing_time: boolean;
}

export interface Settings {
  timezone: string;
  reminders: {
    hours_48: boolean;
    hours_24: boolean;
    hours_2: boolean;
  };
  auto_confirm_threshold: number;
}

export interface StorageData {
  deadlines: DeadlineItem[];
  settings: Settings;
}
