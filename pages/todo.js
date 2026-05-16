import { useEffect } from 'react';

export default function TodoPage() {
  useEffect(() => { document.title = 'Tasks'; }, []);
  return (
    <div style={{height:'100vh',margin:0}}>
      <iframe src="/todo/index.html" style={{width:'100%',height:'100%',border:'0'}} title="Tasks" />
    </div>
  );
}
