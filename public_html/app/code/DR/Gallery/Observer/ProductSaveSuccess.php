<?php

namespace DR\Gallery\Observer;

use Magento\Framework\Event\Observer;
use Magento\Framework\Event\ObserverInterface;
use Magento\Framework\App\Filesystem\DirectoryList;


class ProductSaveSuccess implements ObserverInterface {

	 public function execute(\Magento\Framework\Event\Observer $observer){
	   
	       $product = $observer->getProduct();

			
     



	        if ($product->hasDataChanges()) {
	           $mediaUrl=$product->_filesystem->getDirectoryRead(DirectoryList::MEDIA)->getAbsolutePath();


           foreach ($product->getMediaGallery('images') as $image) {            	
            	if (isset($image['disabled']) && $image['disabled']) {
                    $sourcefile=$mediaUrl.'catalog/product'.$image['file'];
                    $destfile = $mediaUrl.'frame/'.$product->getId().'.jpg';
                    copy($sourcefile,$destfile);
                }               
           
            }
	        }
	        
	  }

}