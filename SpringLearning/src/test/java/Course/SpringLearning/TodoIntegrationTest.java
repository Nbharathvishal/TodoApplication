package Course.SpringLearning;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.util.Map;

import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.is;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
class TodoIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    private String registerAndLogin(String email, String password) throws Exception {
        // Register
        mockMvc.perform(post("/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of("email", email, "password", password))));

        // Login
        MvcResult loginResult = mockMvc.perform(post("/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of("email", email, "password", password))))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode responseNode = objectMapper.readTree(loginResult.getResponse().getContentAsString());
        return responseNode.get("token").asText();
    }

    @Test
    void testUserTodoIsolation() throws Exception {
        String userAEmail = "userA_" + System.currentTimeMillis() + "@example.com";
        String userBEmail = "userB_" + System.currentTimeMillis() + "@example.com";
        String password = "password123";

        String tokenA = registerAndLogin(userAEmail, password);
        String tokenB = registerAndLogin(userBEmail, password);

        // User A creates a todo
        MvcResult todoAResult = mockMvc.perform(post("/api/todo/create")
                .header("Authorization", "Bearer " + tokenA)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of(
                        "title", "User A Workout",
                        "description", "User A Workout Description",
                        "completed", false
                ))))
                .andExpect(status().isCreated())
                .andReturn();

        JsonNode todoANode = objectMapper.readTree(todoAResult.getResponse().getContentAsString());
        long todoAId = todoANode.get("id").asLong();

        // User B creates a todo
        mockMvc.perform(post("/api/todo/create")
                .header("Authorization", "Bearer " + tokenB)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of(
                        "title", "User B Grocery",
                        "description", "User B Grocery Description",
                        "completed", false
                ))))
                .andExpect(status().isCreated());

        // User A fetches todos - should ONLY see User A's todo
        mockMvc.perform(get("/api/todo")
                .header("Authorization", "Bearer " + tokenA))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].title", is("User A Workout")));

        // User B fetches todos - should ONLY see User B's todo
        mockMvc.perform(get("/api/todo")
                .header("Authorization", "Bearer " + tokenB))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].title", is("User B Grocery")));

        // User B tries to fetch User A's todo by ID - should return 404 NOT_FOUND
        mockMvc.perform(get("/api/todo/" + todoAId)
                .header("Authorization", "Bearer " + tokenB))
                .andExpect(status().isNotFound());

        // User B tries to delete User A's todo by ID - should not delete it
        mockMvc.perform(delete("/api/todo/" + todoAId)
                .header("Authorization", "Bearer " + tokenB));

        // User A's todo should still exist and belong to User A
        mockMvc.perform(get("/api/todo/" + todoAId)
                .header("Authorization", "Bearer " + tokenA))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title", is("User A Workout")));
    }
}
