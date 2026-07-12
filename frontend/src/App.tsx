import { useEffect, useState } from "react";import { Login } from "./features/auth/Login";import { TaskBoard } from "./features/tasks/TaskBoard";import { Settings } from "./features/auth/Settings";import { Users } from "./features/auth/Users";import { api } from "./api/client";
export function App(){
  const [loggedIn,setLoggedIn]=useState<boolean|null>(null);
  const [page,setPage]=useState<"tasks"|"settings"|"users">("tasks");
  useEffect(()=>{api("/auth/me").then(()=>setLoggedIn(true)).catch(()=>setLoggedIn(false))},[]);
  if(loggedIn===null)return null;
  if(!loggedIn)return <Login onLogin={()=>setLoggedIn(true)}/>;
  return <><nav><button onClick={()=>setPage("tasks")}>Tasks</button><button onClick={()=>setPage("settings")}>Settings</button><button onClick={()=>setPage("users")}>Users</button><button onClick={()=>{void api("/auth/logout",{method:"POST"}).finally(()=>setLoggedIn(false))}}>Sign out</button></nav>{page==="tasks"?<TaskBoard/>:page==="settings"?<Settings/>:<Users/>}</>
}
