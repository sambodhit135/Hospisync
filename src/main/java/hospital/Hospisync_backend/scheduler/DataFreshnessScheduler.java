package hospital.Hospisync_backend.scheduler;

import hospital.Hospisync_backend.model.Hospital;
import hospital.Hospisync_backend.repository.HospitalRepository;
import hospital.Hospisync_backend.service.EmailService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.List;

@Component
@RequiredArgsConstructor
@Slf4j
public class DataFreshnessScheduler {

    private final HospitalRepository hospitalRepository;
    private final EmailService emailService;
    private final hospital.Hospisync_backend.repository.NotificationRepository notificationRepository;

    /**
     * Runs every hour. Checks hospitals that haven't updated data in 24 hours
     * and sends email + in-app notification reminders.
     */
    @Scheduled(fixedRate = 3600000) // 1 hour
    public void checkDataFreshness() {
        log.info("Running data freshness check...");
        LocalDateTime threshold = LocalDateTime.now().minusHours(24);
        List<Hospital> staleHospitals = hospitalRepository.findByLastUpdatedBefore(threshold);

        for (Hospital hospital : staleHospitals) {
            log.info("Hospital '{}' has stale data (last updated: {})",
                    hospital.getHospitalName(), hospital.getLastUpdated());

            // Send email reminder
            emailService.sendDataUpdateReminder(hospital.getEmail(), hospital.getHospitalName());

            // Create in-app notification (Deduplicated)
            java.util.Optional<hospital.Hospisync_backend.model.Notification> existing = 
                notificationRepository.findByHospital_IdAndNotificationTypeAndIsRead(
                    hospital.getId(),
                    "BED_UPDATE_WARNING",
                    false
                );

            if (existing.isPresent()) {
                hospital.Hospisync_backend.model.Notification n = existing.get();
                n.setTriggerCount(n.getTriggerCount() + 1);
                n.setLastTriggered(LocalDateTime.now());
                notificationRepository.save(n);
            } else {
                hospital.Hospisync_backend.model.Notification n = new hospital.Hospisync_backend.model.Notification();
                n.setHospital(hospital);
                n.setNotificationType("BED_UPDATE_WARNING");
                n.setType("DATA_REMINDER"); // Mapping for UI compatibility
                n.setMessage(
                    "Your hospital has not updated bed data in the last 24 hours. " +
                    "Please update your data to maintain accurate forecasting.");
                n.setIsRead(false);
                n.setTriggerCount(1);
                n.setLastTriggered(LocalDateTime.now());
                notificationRepository.save(n);
            }
        }

        if (staleHospitals.isEmpty()) {
            log.info("All hospitals have fresh data.");
        }
    }
}
