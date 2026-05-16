// Auto-dismiss alerts após 5s
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.alert.alert-success').forEach(el => {
    setTimeout(() => {
      const bsAlert = bootstrap.Alert.getOrCreateInstance(el);
      bsAlert.close();
    }, 5000);
  });
});
