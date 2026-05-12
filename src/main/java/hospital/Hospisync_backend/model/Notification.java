package hospital.Hospisync_backend.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "notifications")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
public class Notification {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "hospital_id", nullable = false)
    private Hospital hospital;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String message;

    @Column(nullable = false)
    private String type; // DATA_REMINDER, TRANSFER_REQUEST, SYSTEM

    @Column(name = "notification_type")
    private String notificationType; // e.g. "BED_UPDATE_WARNING"

    @Builder.Default
    @Column(name = "is_read", nullable = false)
    private Boolean isRead = false;

    @Builder.Default
    @Column(name = "trigger_count")
    private Integer triggerCount = 1;

    @Column(name = "last_triggered")
    private LocalDateTime lastTriggered;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        this.createdAt = LocalDateTime.now();
        if (this.lastTriggered == null) {
            this.lastTriggered = LocalDateTime.now();
        }
    }
}
