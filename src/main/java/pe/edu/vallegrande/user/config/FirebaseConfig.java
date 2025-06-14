package pe.edu.vallegrande.user.config;

import com.google.auth.oauth2.GoogleCredentials;
import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;
import jakarta.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.util.Base64;

/**
 * Configura e inicializa Firebase Admin SDK con credenciales en Base64.
 */
@Configuration
public class FirebaseConfig {

    @Value("${firebase.credentials}")
    private String credentialsBase64;

    @PostConstruct
    public void initialize() throws IOException {
        byte[] decoded = Base64.getDecoder().decode(credentialsBase64);

        try (ByteArrayInputStream stream = new ByteArrayInputStream(decoded)) {
            FirebaseOptions options = FirebaseOptions.builder()
                    .setCredentials(GoogleCredentials.fromStream(stream))
                    .build();

            if (FirebaseApp.getApps().isEmpty()) {
                FirebaseApp.initializeApp(options);
                System.out.println("✅ Firebase inicializado correctamente");
            }
        }
    }
}
