package pe.edu.vallegrande.user.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import pe.edu.vallegrande.user.config.CustomAuthenticationToken;
import pe.edu.vallegrande.user.dto.UserDto;
import pe.edu.vallegrande.user.service.UserService;
import reactor.core.publisher.Mono;

import java.util.Map;
@CrossOrigin(origins = "*")
@RestController
@RequestMapping("/api/users")
class UserController {

    private final UserService userService;

    @Autowired
    public UserController(UserService userService) {
        this.userService = userService;
    }

    /**
     * 🔍 Obtener mi perfil por UID
     */
    @GetMapping("/me")
    @PreAuthorize("hasAnyRole('ADMIN', 'USER')")
    public Mono<UserDto> getMyProfile(@AuthenticationPrincipal CustomAuthenticationToken auth) {
        return userService.findMyProfile(auth.getName());
    }

}
