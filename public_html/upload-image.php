<?php


function resize($newWidth, $targetFile, $originalFile) {
    
        $info = getimagesize($originalFile);
        $mime = $info['mime'];
    
        switch ($mime) {
                case 'image/jpeg':
                        $image_create_func = 'imagecreatefromjpeg';
                        $image_save_func = 'imagejpeg';
                        $new_image_ext = 'jpg';
                        break;
    
                case 'image/png':
                        $image_create_func = 'imagecreatefrompng';
                        $image_save_func = 'imagepng';
                        $new_image_ext = 'png';
                        break;
    
                case 'image/gif':
                        $image_create_func = 'imagecreatefromgif';
                        $image_save_func = 'imagegif';
                        $new_image_ext = 'gif';
                        break;
    
                default: 
                        throw new Exception('Unknown image type.');
        }
    
        $img = $image_create_func($originalFile);
        list($width, $height) = getimagesize($originalFile);
    
        $newHeight = ($height / $width) * $newWidth;
        $tmp = imagecreatetruecolor($newWidth, $newHeight);
        imagecopyresampled($tmp, $img, 0, 0, 0, 0, $newWidth, $newHeight, $width, $height);
    
        if (file_exists($targetFile)) {
                unlink($targetFile);
        }
        $image_save_func($tmp, "$targetFile");
        return 1;
    }
    
    
if($_SERVER["REQUEST_METHOD"] == "POST"){

    // Check if file was uploaded without errors

    if(isset($_FILES["file"]) && $_FILES["file"]["error"] == 0){

        $allowed = array("jpg" => "image/jpg", "jpeg" => "image/jpeg", "gif" => "image/gif", "png" => "image/png","JPG" => "image/jpg", "JPEG" => "image/jpeg", "GIF" => "image/gif", "PNG" => "image/png");

        $filename = $_FILES["file"]["name"];

        $filetype = $_FILES["file"]["type"];

        $filesize = $_FILES["file"]["size"];

    

        // Verify file extension

        $ext = pathinfo($filename, PATHINFO_EXTENSION);

        if(!array_key_exists($ext, $allowed)) die("Error: Please select a valid file format.");

    

        // Verify file size - 5MB maximum

        $maxsize = 20 * 1024 * 1024;

        if($filesize > $maxsize) die("Error: File size is larger than the allowed limit.");

    

        // Verify MYME type of the file

        if(in_array($filetype, $allowed)){

            // Check whether file exists before uploading it

            if(file_exists("pub/media/gallery/byUser/" . $_FILES["file"]["name"])){

                echo $_FILES["file"]["name"] . " is already exists.";

            } else{
                $newfile_name = time().rand().'.'.$ext;
                move_uploaded_file($_FILES["file"]["tmp_name"], "pub/media/gallery/byUser/original/" .$newfile_name);
                $target="pub/media/gallery/byUser/" .$newfile_name;
                $original="pub/media/gallery/byUser/original/" .$newfile_name;
                $t=resize(400,$target,$original);
                if($t==1)
                    echo json_encode(array('status' => 'Your file was uploaded successfully.','file'=>$newfile_name));
               

            } 

        } else{

            echo "Error: There was a problem uploading your file. Please try again."; 

        }

    } else{

        echo "Error: " . $_FILES["file"]["error"];

    }

}



?>
