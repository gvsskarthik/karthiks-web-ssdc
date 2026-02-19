
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

public class TestPass {
    public static void main(String[] args) {
        BCryptPasswordEncoder encoder = new BCryptPasswordEncoder();
        String raw = "123456";
        String encoded = encoder.encode(raw);
        System.out.println("Raw: " + raw);
        System.out.println("Encoded: " + encoded);
        
        // Also test the problematic hash from DB if I can copy it
        String oldHash = "$2a$10$8.UnVuG9HHgffUDAlk8qfOuVGkqRzgVwdF5qCmDXzBp.5Y/Q.Sbm";
        boolean matches = encoder.matches(raw, oldHash);
        System.out.println("Old hash matches '123456'? " + matches);
    }
}
