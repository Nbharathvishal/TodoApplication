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

import static org.hamcrest.Matchers.greaterThanOrEqualTo;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.is;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:testdb;DB_CLOSE_DELAY=-1;MODE=PostgreSQL",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
        "spring.jpa.database-platform=org.hibernate.dialect.H2Dialect",
        "spring.jpa.hibernate.ddl-auto=create-drop"
})
@AutoConfigureMockMvc
class TodoIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    private String registerAndLogin(String email, String password) throws Exception {
        mockMvc.perform(post("/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of("email", email, "password", password))));

        MvcResult loginResult = mockMvc.perform(post("/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of("email", email, "password", password))))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode responseNode = objectMapper.readTree(loginResult.getResponse().getContentAsString());
        return responseNode.get("token").asText();
    }

    @Test
    void testAuthEndpoints() throws Exception {
        // Ping
        mockMvc.perform(get("/auth/ping"))
                .andExpect(status().isOk())
                .andExpect(content().string("pong"));

        String email = "auth_test_" + System.currentTimeMillis() + "@example.com";
        String password = "password123";

        // Register
        mockMvc.perform(post("/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of("email", email, "password", password))))
                .andExpect(status().isCreated());

        // Register duplicate
        mockMvc.perform(post("/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of("email", email, "password", password))))
                .andExpect(status().isConflict());

        // Login success
        mockMvc.perform(post("/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of("email", email, "password", password))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").isString());

        // Login wrong password
        mockMvc.perform(post("/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of("email", email, "password", "wrongpass"))))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void testTodoAllEndpoints() throws Exception {
        String email = "crud_user_" + System.currentTimeMillis() + "@example.com";
        String token = registerAndLogin(email, "password123");

        // 1. Create Todo via POST /api/todo/create
        MvcResult createResult = mockMvc.perform(post("/api/todo/create")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of(
                        "title", "Initial Mission",
                        "description", "Initial Mission Description",
                        "completed", false
                ))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.title", is("Initial Mission")))
                .andExpect(jsonPath("$.completed", is(false)))
                .andReturn();

        JsonNode createdNode = objectMapper.readTree(createResult.getResponse().getContentAsString());
        long todoId = createdNode.get("id").asLong();

        // 2. GET all todos via GET /api/todo
        mockMvc.perform(get("/api/todo")
                .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].id", is((int) todoId)));

        // 3. GET todo by ID via GET /api/todo/{id}
        mockMvc.perform(get("/api/todo/" + todoId)
                .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title", is("Initial Mission")));

        // 4. GET page of todos via GET /api/todo/page?page=0&size=10
        mockMvc.perform(get("/api/todo/page?page=0&size=10")
                .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content", hasSize(1)));

        // 5. Update Todo via PUT /api/todo (body contains ID)
        mockMvc.perform(put("/api/todo")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of(
                        "id", todoId,
                        "title", "Updated Mission Title",
                        "description", "Updated Mission Description",
                        "completed", true
                ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title", is("Updated Mission Title")))
                .andExpect(jsonPath("$.completed", is(true)));

        // 6. Update Todo via PUT /api/todo/{id} (path ID)
        mockMvc.perform(put("/api/todo/" + todoId)
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of(
                        "title", "Path Updated Mission Title",
                        "description", "Path Updated Mission Description",
                        "completed", false
                ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title", is("Path Updated Mission Title")))
                .andExpect(jsonPath("$.completed", is(false)));

        // 7. Verify 404 for non-existent ID on PUT
        mockMvc.perform(put("/api/todo/99999")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of(
                        "title", "Non existent",
                        "description", "Desc",
                        "completed", false
                ))))
                .andExpect(status().isNotFound());

        // 8. Delete Todo via DELETE /api/todo/{id}
        mockMvc.perform(delete("/api/todo/" + todoId)
                .header("Authorization", "Bearer " + token))
                .andExpect(status().isNoContent());

        // 9. Verify GET /api/todo/{id} returns 404 after deletion
        mockMvc.perform(get("/api/todo/" + todoId)
                .header("Authorization", "Bearer " + token))
                .andExpect(status().isNotFound());
    }

    @Test
    void testLongHabitMetadataDescription() throws Exception {
        String email = "habit_user_" + System.currentTimeMillis() + "@example.com";
        String token = registerAndLogin(email, "password123");

        // Long habit metadata with multiple days completed (> 300 characters)
        String longDescription = "call to creakers shop\n<!--taskverse:{" +
                "\"priority\":\"Medium\"," +
                "\"dueDate\":\"2026-11-05\"," +
                "\"category\":\"Work\"," +
                "\"recurrence\":{\"frequency\":\"none\",\"customDays\":[1,2,3,4,5],\"endType\":\"never\",\"endDate\":null,\"endCount\":10,\"seriesId\":null,\"isPaused\":false,\"isOccurrence\":false}," +
                "\"goal\":30," +
                "\"completedDates\":[\"2026-11-01\",\"2026-11-02\",\"2026-11-03\",\"2026-11-04\",\"2026-11-05\",\"2026-11-06\",\"2026-11-07\"]" +
                "}-->";

        // Create with long description
        MvcResult res = mockMvc.perform(post("/api/todo/create")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of(
                        "title", "call to creakers shop",
                        "description", longDescription,
                        "completed", true
                ))))
                .andExpect(status().isCreated())
                .andReturn();

        JsonNode node = objectMapper.readTree(res.getResponse().getContentAsString());
        long id = node.get("id").asLong();

        // Update with even longer description (> 350 characters)
        String evenLongerDescription = longDescription.replace("2026-11-07\"]", "2026-11-07\",\"2026-11-08\",\"2026-11-09\",\"2026-11-10\"]");

        mockMvc.perform(put("/api/todo")
                .header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of(
                        "id", id,
                        "title", "call to creakers shop",
                        "description", evenLongerDescription,
                        "completed", true
                ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.description", is(evenLongerDescription)));
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
