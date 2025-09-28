export interface ListItemNode {
  id: string;
  text: string;
  isCollapsed: boolean;
  children: ListItemNode[];
}

export interface AppFile {
  id: string;
  name: string;
}

export interface DocumentViewState {
  collapsedPaths: number[][];
}

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  picture: string;
}