function showSignup() {
  document.getElementById("loginForm").hidden = true;
  document.getElementById("signupForm").hidden = false;
}

function showLogin() {
  document.getElementById("signupForm").hidden = true;
  document.getElementById("loginForm").hidden = false;
}

// TEMP login logic
document.getElementById("loginForm").addEventListener("submit", function(e){
  e.preventDefault();
  if (
          document.getElementById("loginUser").value === "admin" &&
          document.getElementById("loginPass").value === "1234"
  ) {
    window.location.href = "dashboard.html";
  } else {
    alert("Invalid login");
  }
});

// TEMP signup logic
document.getElementById("signupForm").addEventListener("submit", function(e){
  e.preventDefault();
  alert("Signup successful! Now login.");
  showLogin();
});
