import javax.swing.*;
import java.awt.*;
import java.awt.event.*;

public class AdditionGUI extends JFrame {

    private JTextField num1Field;
    private JTextField num2Field;
    private JLabel resultLabel;

    public AdditionGUI() {
        setTitle("Addition Calculator");
        setSize(350, 250);
        setDefaultCloseOperation(JFrame.EXIT_ON_CLOSE);
        setLayout(new GridLayout(4, 2, 10, 10));

        JLabel num1Label = new JLabel("First Number:");
        num1Field = new JTextField();

        JLabel num2Label = new JLabel("Second Number:");
        num2Field = new JTextField();

        JButton addButton = new JButton("ADD");

        resultLabel = new JLabel("Result: ");

        add(num1Label);
        add(num1Field);

        add(num2Label);
        add(num2Field);

        add(addButton);
        add(resultLabel);

        // ADD button action
        addButton.addActionListener(new ActionListener() {
            @Override
            public void actionPerformed(ActionEvent e) {
                try {
                    double num1 = Double.parseDouble(num1Field.getText());
                    double num2 = Double.parseDouble(num2Field.getText());

                    double sum = num1 + num2;

                    resultLabel.setText("Result: " + sum);
                } catch (NumberFormatException ex) {
                    resultLabel.setText("Please enter valid numbers.");
                }
            }
        });

        setLocationRelativeTo(null);
        setVisible(true);
    }

    public static void main(String[] args) {
        new AdditionGUI();
    }
}
