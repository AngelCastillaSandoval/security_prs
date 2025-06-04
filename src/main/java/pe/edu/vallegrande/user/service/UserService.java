package pe.edu.vallegrande.user.service;

import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.UserRecord.CreateRequest;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;
import lombok.extern.slf4j.Slf4j;

import pe.edu.vallegrande.user.dto.UserCreateDto;
import pe.edu.vallegrande.user.dto.UserDto;
import pe.edu.vallegrande.user.model.User;
import pe.edu.vallegrande.user.repository.UsersRepository;

import java.util.Map;


@Slf4j
@Service
public class UserService {

    private final UsersRepository usersRepository;
    private final PasswordEncoder passwordEncoder;


    @Autowired
    public UserService(UsersRepository usersRepository, PasswordEncoder passwordEncoder,
                      ) {
        this.usersRepository = usersRepository;
        this.passwordEncoder = passwordEncoder;
    }

    /**
     * 🔹 Guardar nuevo usuario en firebase como en la bd
     */
    public Mono<UserDto> createUser(UserCreateDto dto) {
        return usersRepository.findByEmail(dto.getEmail())
                .flatMap(existing -> Mono.error(new IllegalArgumentException("El correo ya está en uso.")))
                .switchIfEmpty(Mono.defer(() -> {
                    // 🔐 Crear usuario en Firebase
                    CreateRequest request = new CreateRequest()
                            .setEmail(dto.getEmail())
                            .setPassword(dto.getPassword())
                            .setEmailVerified(false)
                            .setDisabled(false);

                    return Mono.fromCallable(() -> FirebaseAuth.getInstance().createUser(request))
                            .flatMap(firebaseUser -> {
                                String uid = firebaseUser.getUid();

                                // Asignar claim
                                String primaryRole = dto.getRole().isEmpty() ? "USER" : dto.getRole().get(0);
                                return Mono.fromCallable(() -> {
                                    FirebaseAuth.getInstance().setCustomUserClaims(uid, Map.of("role", primaryRole.toUpperCase()));
                                    return uid;
                                }).cast(String.class);
                            })
                            .flatMap(uid -> {
                                // Subir imagen a Supabase
                                return storageService.uploadBase64Image("users", dto.getProfileImage())
                                        .flatMap(imageUrl -> {
                                            // Guardar en BD
                                            User user = new User();
                                            user.setFirebaseUid(uid);
                                            user.setName(dto.getName());
                                            user.setLastName(dto.getLastName());
                                            user.setDocumentType(dto.getDocumentType());
                                            user.setDocumentNumber(dto.getDocumentNumber());
                                            user.setCellPhone(dto.getCellPhone());
                                            user.setEmail(dto.getEmail());
                                            user.setPassword(passwordEncoder.encode(dto.getPassword()));
                                            user.setRole(dto.getRole());
                                            user.setProfileImage(imageUrl); // Guardar URL de la imagen

                                            return usersRepository.save(user)
                                                    .map(this::toDto)
                                                    .cast(UserDto.class);
                                        });
                            });
                })).cast(UserDto.class);
    }

    /**
     * 🔹 Actualizar usuario
     */
    public Mono<UserDto> updateUser(Integer id, UserDto dto) {
        return usersRepository.findById(id)
                .switchIfEmpty(Mono.error(new IllegalArgumentException("Usuario no encontrado")))
                .flatMap(existing -> {
                    boolean roleChanged = !existing.getRole().equals(dto.getRole());

                    // Actualizar campos editables
                    existing.setName(dto.getName());
                    existing.setLastName(dto.getLastName());
                    existing.setDocumentType(dto.getDocumentType());
                    existing.setDocumentNumber(dto.getDocumentNumber());
                    existing.setCellPhone(dto.getCellPhone());
                    existing.setRole(dto.getRole());

                    String newImage = dto.getProfileImage();


                });
    }


    /**
     * 🔹 Obtener todos los usuarios
     */
    public Flux<UserDto> findAllUsers() {
        return usersRepository.findAll()
                .map(this::toDto);
    }

    /**
     * 🔹 Buscar por ID
     */
    public Mono<UserDto> findById(Integer id) {
        return usersRepository.findById(id)
                .map(this::toDto);
    }


    /**
     * 🔹 Eliminar por ID
     */
    public Mono<Void> deleteUser(Integer id) {
        return usersRepository.findById(id)
                .switchIfEmpty(Mono.error(new RuntimeException("Usuario no encontrado")))
                .flatMap(user -> {
                    String firebaseUid = user.getFirebaseUid();

                    // 1. Eliminar imagen si existe
                    Mono<Void> imageDeletion = user.getProfileImage() != null
                            ? storageService.deleteImage(user.getProfileImage())
                            : Mono.empty();

                    // 2. Eliminar usuario en Firebase
                    Mono<Void> firebaseDeletion = Mono.fromCallable(() -> {
                        FirebaseAuth.getInstance().deleteUser(firebaseUid);
                        return null;
                    });

                    // 3. Eliminar en base de datos
                    Mono<Void> dbDeletion = usersRepository.deleteById(user.getId());

                    // ⛓️ Ejecutar todo en orden
                    return imageDeletion
                            .then(firebaseDeletion)
                            .then(dbDeletion);
                });
    }



    /**
     * 🔁 Método auxiliar: Entity → DTO
     */
    private UserDto toDto(User user) {
        return new UserDto(
                user.getId(),
                user.getFirebaseUid(),
                user.getName(),
                user.getLastName(),
                user.getDocumentType(),
                user.getDocumentNumber(),
                user.getCellPhone(),
                user.getEmail(),
                user.getRole(),
                user.getProfileImage()
        );
    }
}
