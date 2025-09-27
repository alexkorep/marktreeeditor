export interface ListItemNode {
  id: string;
  text: string;
  children: ListItemNode[];
}

export interface AppFile {
  id: string;
  name: string;
}

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  picture: string;
}