document.addEventListener('DOMContentLoaded', () => {
  const steps = {
    1: document.getElementById('step1'),
    2: document.getElementById('step2'),
    3: document.getElementById('step3')
  };

  const btnNext1 = document.getElementById('btnNext1');
  const btnVerify = document.getElementById('btnVerify');
  const btnRestart = document.getElementById('btnRestart');
  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('fileInput');
  const previewImg = document.getElementById('previewImg');
  const nameInput = document.getElementById('nameInput');
  
  let selectedFile = null;

  function showStep(step) {
    Object.values(steps).forEach(el => el.classList.remove('active'));
    steps[step].classList.add('active');
  }

  btnNext1.addEventListener('click', () => {
    if (!nameInput.value.trim()) {
      nameInput.focus();
      return;
    }
    showStep(2);
  });

  // File Upload Logic
  dropzone.addEventListener('click', () => fileInput.click());

  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('dragover');
  });

  dropzone.addEventListener('dragleave', () => {
    dropzone.classList.remove('dragover');
  });

  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    if (e.dataTransfer.files.length) {
      handleFile(e.dataTransfer.files[0]);
    }
  });

  fileInput.addEventListener('change', (e) => {
    if (e.target.files.length) {
      handleFile(e.target.files[0]);
    }
  });

  function handleFile(file) {
    selectedFile = file;
    btnVerify.disabled = false;
    
    // Show preview if image
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        previewImg.src = e.target.result;
        previewImg.style.display = 'inline-block';
      };
      reader.readAsDataURL(file);
    } else if (file.type === 'application/pdf') {
      previewImg.style.display = 'none';
      const hint = dropzone.querySelector('.dropzone-hint');
      hint.textContent = "PDF Selected: " + file.name;
      hint.style.color = "var(--primary)";
      hint.style.fontWeight = "bold";
    }
  }

  // API Call
  btnVerify.addEventListener('click', async () => {
    if (!selectedFile) return;
    showStep(3);

    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      // Direct call to KYC Verification API
      const response = await fetch('http://localhost:8000/api/v1/verify-document', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.detail || 'Verification failed');
      }

      showResult(data);
    } catch (err) {
      showResult({ status: 'error', error: err.message });
    }
  });

  function showResult(data) {
    document.getElementById('loadingState').style.display = 'none';
    const resultState = document.getElementById('resultState');
    resultState.style.display = 'block';

    const icon = document.getElementById('resultIcon');
    const title = document.getElementById('resultTitle');
    const desc = document.getElementById('resultDesc');
    const table = document.getElementById('dataTable');
    const tbody = table.querySelector('tbody');

    icon.classList.remove('success', 'error', 'warning', 'loading');
    tbody.innerHTML = '';

    if (data.status === 'verified') {
      icon.classList.add('success');
      icon.innerHTML = '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline>';
      title.textContent = 'Account Approved!';
      desc.textContent = 'Identity matched with core registry.';
      
      table.style.display = 'table';
      
      if (data.ocr && data.ocr.fields) {
        const fields = data.ocr.fields;
        const addRow = (label, val) => {
          if (!val) return;
          const tr = document.createElement('tr');
          tr.innerHTML = `<td>${label}</td><td>${val}</td>`;
          tbody.appendChild(tr);
        };
        
        addRow('Name', fields.name);
        addRow('Date of Birth', fields.date_of_birth);
        addRow('ID Number', fields.document_id);
        addRow('Confidence', data.ocr.ocr_confidence + '%');
      }

    } else if (data.status === 'flagged' || data.status === 'error') {
      icon.classList.add('error');
      icon.innerHTML = '<circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line>';
      title.textContent = 'Verification Failed';
      desc.textContent = data.error || 'Identity could not be verified automatically.';
    } else {
      icon.classList.add('warning');
      icon.innerHTML = '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line>';
      title.textContent = 'Pending Review';
      desc.textContent = 'Your application requires manual review by our team.';
    }
  }

  btnRestart.addEventListener('click', () => {
    // Reset and go to step 1
    selectedFile = null;
    fileInput.value = '';
    previewImg.style.display = 'none';
    previewImg.src = '';
    btnVerify.disabled = true;
    document.querySelector('.dropzone-hint').textContent = "Supports JPG, PNG, PDF (Max 10MB)";
    document.querySelector('.dropzone-hint').style.color = "var(--text-muted)";
    
    document.getElementById('loadingState').style.display = 'block';
    document.getElementById('resultState').style.display = 'none';
    
    showStep(1);
  });

});
