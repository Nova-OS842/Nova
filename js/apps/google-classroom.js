window.GoogleClassroomApp={
  id:'google-classroom',
  name:'Google Classroom',
  description:'Open the official Google Classroom for classes and classwork.',
  icon:'assets/icons/google-classroom.svg',
  width:920,
  height:620,
  mount(body){
    const url='https://classroom.google.com/';
    body.innerHTML=`
      <div class="google-classroom-app google-classroom-launcher">
        <div class="gc-launcher-glow"></div>
        <section class="gc-launcher-card">
          <div class="gc-launcher-icon"><img src="assets/icons/google-classroom.svg" alt="Google Classroom"></div>
          <span class="gc-eyebrow">GOOGLE CLASSROOM</span>
          <h1>Open your classes</h1>
          <p>Nova uses the official Google Classroom website. Your Google account, classes, assignments, classwork, submissions, and teacher tools stay on Google.</p>
          <button type="button" class="gc-open-large" data-open-classroom>Open Google Classroom <span>↗</span></button>
          <div class="gc-launcher-note"><span>✓</span><div><strong>Official Google service</strong><small>Classroom is opened as a normal web page instead of an embedded frame.</small></div></div>
        </section>
      </div>`;

    const open=()=>{
      const w=window.open(url,'_blank','noopener,noreferrer');
      if(!w){
        const a=document.createElement('a');
        a.href=url;
        a.target='_blank';
        a.rel='noopener noreferrer';
        a.click();
        OS.toast('Allow pop-ups for Nova to open Google Classroom.');
      }
    };
    body.querySelectorAll('[data-open-classroom]').forEach(b=>b.addEventListener('click',open));
    return()=>{};
  }
};
