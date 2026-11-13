package Course.SpringLearning.Service;

import Course.SpringLearning.Models.Todo;
import Course.SpringLearning.Models.User;
import Course.SpringLearning.Repository.TodoRepository;
import Course.SpringLearning.Repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class UserSevice {

    private final UserRepository userRepository;
    private final TodoRepository todoRepository;

    public User createUser(User user){
        return userRepository.save(user);
    }

    public User getUserById(Long id){
        return userRepository.findById(id).orElseThrow(() -> new RuntimeException("User Not Found"));
    }

    @Transactional
    public void deleteUserAndData(User user) {
        List<Todo> todos = todoRepository.findByUser(user);
        if (todos != null && !todos.isEmpty()) {
            todoRepository.deleteAll(todos);
        }
        userRepository.delete(user);
    }
}
