package Course.SpringLearning.Controller;

import Course.SpringLearning.Models.User;
import Course.SpringLearning.Repository.UserRepository;
import Course.SpringLearning.Service.UserSevice;
import Course.SpringLearning.utils.JwtUtil;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Locale;
import java.util.Map;
import java.util.Optional;

@RestController
@RequiredArgsConstructor
@RequestMapping("/auth")
@Slf4j
public class AuthController {

    private final UserSevice userSevice;
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;

    @GetMapping("/ping")
    public ResponseEntity<String> ping() {
        return ResponseEntity.ok("pong");
    }

    private String normalizeEmail(String email) {
        if (email == null) return null;
        return email.trim().toLowerCase(Locale.ROOT);
    }

    private Optional<User> findUserByEmailNormalized(String email) {
        if (email == null || email.isBlank()) {
            return Optional.empty();
        }
        String normalized = normalizeEmail(email);
        Optional<User> userOpt = userRepository.findByEmailIgnoreCase(normalized);
        if (userOpt.isPresent()) {
            return userOpt;
        }
        return userRepository.findByEmail(email.trim())
                .or(() -> userRepository.findByEmail(email));
    }

    @PostMapping("/register")
    public ResponseEntity<String> registerUser(@RequestBody Map<String, String> body) {
        String rawEmail = body != null ? body.get("email") : null;
        String rawPassword = body != null ? body.get("password") : null;

        if (rawEmail == null || rawEmail.trim().isEmpty() || rawPassword == null || rawPassword.isEmpty()) {
            return new ResponseEntity<>("Please enter both email and password.", HttpStatus.BAD_REQUEST);
        }

        String normalizedEmail = normalizeEmail(rawEmail);

        if (findUserByEmailNormalized(normalizedEmail).isPresent()) {
            return new ResponseEntity<>("This email address is already registered. Please sign in.", HttpStatus.CONFLICT);
        }

        String encodedPassword = passwordEncoder.encode(rawPassword);
        userSevice.createUser(User.builder().email(normalizedEmail).password(encodedPassword).build());

        return new ResponseEntity<>("Successfully Created", HttpStatus.CREATED);
    }

    @PostMapping("/login")
    public ResponseEntity<?> loginUser(@RequestBody Map<String, String> body) {
        String rawEmail = body != null ? body.get("email") : null;
        String rawPassword = body != null ? body.get("password") : null;

        if (rawEmail == null || rawEmail.trim().isEmpty() || rawPassword == null || rawPassword.isEmpty()) {
            return new ResponseEntity<>("Please enter both email and password.", HttpStatus.BAD_REQUEST);
        }

        String normalizedEmail = normalizeEmail(rawEmail);
        var userOptional = findUserByEmailNormalized(normalizedEmail);

        if (userOptional.isEmpty()) {
            return new ResponseEntity<>("No account found with this email address. Please register.", HttpStatus.UNAUTHORIZED);
        }

        User user = userOptional.get();
        String storedPassword = user.getPassword();

        boolean passwordMatches = false;
        try {
            if (storedPassword != null) {
                passwordMatches = passwordEncoder.matches(rawPassword, storedPassword);
            }
        } catch (Exception ex) {
            log.warn("BCrypt matching encountered an unexpected format: {}", ex.getMessage());
        }

        // Seamless legacy upgrade: if the existing user was created with a plaintext password
        // (e.g. manual database insertion or legacy unhashed format), verify and upgrade to BCrypt.
        if (!passwordMatches && storedPassword != null) {
            if (rawPassword.equals(storedPassword) || rawPassword.trim().equals(storedPassword.trim())) {
                passwordMatches = true;
                try {
                    user.setPassword(passwordEncoder.encode(rawPassword));
                    userRepository.save(user);
                    log.info("Successfully upgraded legacy password to BCrypt hash for user");
                } catch (Exception ex) {
                    log.error("Failed to upgrade legacy password hash: {}", ex.getMessage());
                }
            }
        }

        if (!passwordMatches) {
            return new ResponseEntity<>("Incorrect email or password.", HttpStatus.UNAUTHORIZED);
        }

        String tokenEmail = (user.getEmail() != null && !user.getEmail().isBlank()) ? user.getEmail() : normalizedEmail;
        String token = jwtUtil.generateToken(tokenEmail);

        return ResponseEntity.ok(Map.of("token", token));
    }

    @PostMapping("/delete-account")
    public ResponseEntity<?> deleteAccount(HttpServletRequest request, @RequestBody(required = false) Map<String, String> body) {
        return processDeleteAccount(request, body);
    }

    @DeleteMapping("/delete-account")
    public ResponseEntity<?> deleteAccountDelete(HttpServletRequest request, @RequestBody(required = false) Map<String, String> body) {
        return processDeleteAccount(request, body);
    }

    private ResponseEntity<?> processDeleteAccount(HttpServletRequest request, Map<String, String> body) {
        String authHeader = request.getHeader("Authorization");
        String token = null;
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            token = authHeader.substring(7);
        }

        if (token == null || !jwtUtil.validationToken(token)) {
            return new ResponseEntity<>("Unauthorized: Valid session required.", HttpStatus.UNAUTHORIZED);
        }

        String authenticatedEmail = jwtUtil.extractEmail(token);
        if (authenticatedEmail == null || authenticatedEmail.isBlank()) {
            return new ResponseEntity<>("Unauthorized.", HttpStatus.UNAUTHORIZED);
        }

        String rawPassword = body != null ? body.get("password") : null;
        if (rawPassword == null || rawPassword.isEmpty()) {
            return new ResponseEntity<>("Password confirmation is required.", HttpStatus.BAD_REQUEST);
        }

        var userOptional = findUserByEmailNormalized(authenticatedEmail);
        if (userOptional.isEmpty()) {
            return new ResponseEntity<>("User account not found.", HttpStatus.NOT_FOUND);
        }

        User user = userOptional.get();
        String storedPassword = user.getPassword();

        boolean passwordMatches = false;
        try {
            if (storedPassword != null) {
                passwordMatches = passwordEncoder.matches(rawPassword, storedPassword);
            }
        } catch (Exception ignored) {}

        if (!passwordMatches && storedPassword != null) {
            if (rawPassword.equals(storedPassword) || rawPassword.trim().equals(storedPassword.trim())) {
                passwordMatches = true;
            }
        }

        if (!passwordMatches) {
            return new ResponseEntity<>("Incorrect password. Account deletion cancelled.", HttpStatus.UNAUTHORIZED);
        }

        // Delete all user-owned todos and the user account within an isolated transaction
        userSevice.deleteUserAndData(user);
        log.info("User account and all associated data permanently deleted for email: {}", authenticatedEmail);

        return ResponseEntity.ok(Map.of("message", "Your account and associated data have been permanently deleted."));
    }
}

