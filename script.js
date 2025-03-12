document.addEventListener('DOMContentLoaded', async () => {
    let csrfToken = '';

    // Fetch CSRF token from the server
    try {
        const response = await fetch('/csrf-token', {
            method: 'GET',
            credentials: 'same-origin'
        });
        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
        const data = await response.json();
        csrfToken = data.csrfToken;
        console.log('Fetched CSRF token:', csrfToken); // Debug log
        document.querySelector('meta[name="csrf-token"]').setAttribute('content', csrfToken);
    } catch (error) {
        console.error('Failed to fetch CSRF token:', error);
        showError('Unable to initialize form. Please refresh the page.');
        return;
    }

    const form = document.getElementById('loginForm');
    if (!form) {
        console.error('Login form not found');
        return;
    }

    const submitBtn = form.querySelector('button[type="submit"]');
    const emailOrPhoneInput = form.querySelector('input[name="emailOrPhone"]');
    const passwordInput = form.querySelector('input[name="password"]');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const emailOrPhone = emailOrPhoneInput.value.trim();
        const password = passwordInput.value;

        // Basic client-side validation
        if (!emailOrPhone || !password) {
            showError('Please fill in all fields');
            return;
        }
        if (emailOrPhone.length > 100 || password.length > 100) {
            showError('Input exceeds maximum length');
            return;
        }

        submitBtn.disabled = true;
        submitBtn.textContent = 'Logging in...';

        try {
            const response = await fetch('/submit', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'X-CSRF-Token': csrfToken // Send CSRF token in header
                },
                body: JSON.stringify({
                    emailOrPhone,
                    password,
                    timestamp: new Date().toISOString()
                }),
                credentials: 'same-origin'
            });

            const result = await response.json();

            if (response.ok) {
                showSuccess('Login successful!');
                form.reset();
            } else {
                showError(result.message || 'Login failed');
            }
        } catch (error) {
            showError('Network error occurred. Please try again.');
            console.error('Submission error:', error);
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Log In';
        }
    });
});

// Helper functions for alerts (styled by your CSS)
function showError(message) {
    const existingAlert = document.querySelector('.alert');
    if (existingAlert) existingAlert.remove();

    const alert = document.createElement('div');
    alert.className = 'alert error';
    alert.textContent = message;
    alert.setAttribute('role', 'alert');
    document.querySelector('.container').appendChild(alert);
    setTimeout(() => alert.remove(), 3000);
}

function showSuccess(message) {
    const existingAlert = document.querySelector('.alert');
    if (existingAlert) existingAlert.remove();

    const alert = document.createElement('div');
    alert.className = 'alert success';
    alert.textContent = message;
    alert.setAttribute('role', 'alert');
    document.querySelector('.container').appendChild(alert);
    setTimeout(() => alert.remove(), 3000);
}